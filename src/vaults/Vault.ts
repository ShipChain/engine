/*
 * Copyright 2018 ShipChain, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { StorageDriverFactory } from '../storage/StorageDriverFactory';
import { DriverError, StorageDriver } from '../storage/StorageDriver';
import { ContainerFactory } from './ContainerFactory';
import { Container } from './Container';
import { Wallet } from '../entity/Wallet';

import { ResourceLock } from '../redis';
import * as path from 'path';
import * as utils from '../utils';
import { Logger } from '../Logger';

import zlib from 'zlib';
import compareVersions from 'compare-versions';

const logger = Logger.get(module.filename);

export class Vault {
    protected driver: StorageDriver;
    protected auth;
    public id;
    public containers;
    protected meta;

    private static readonly METADATA_FILE_NAME = 'meta.json';
    private static readonly VAULT_VERSION__INITIAL = '0.0.1';
    private static readonly VAULT_VERSION__ZIP_CONTAINER = '0.0.2';
    private static readonly CURRENT_VAULT_VERSION = Vault.VAULT_VERSION__ZIP_CONTAINER;
    static readonly OWNERS_ROLE = 'owners';
    static readonly LEDGER_ROLE = 'ledger';
    static readonly LEDGER_CONTAINER = 'ledger';

    constructor(auth: any, id?: string) {
        this.id = id || utils.uuidv4();

        this.auth = {
            ...auth,
            base_path: path.join(auth.base_path || './', this.id),
        };

        this.driver = StorageDriverFactory.create(this.auth);

        logger.info(`Instantiating Vault ${this.id} using ${this.auth.driver_type} driver`);
    }

    async getOrCreateMetadata(author: Wallet) {
        if (await this.metadataFileExists()) {
            logger.debug(`Returning existing metadata`);
            return await this.loadMetadata();
        }

        logger.debug(`Creating new metadata`);
        await this.initializeMetadata(author);
        await this.writeMetadata(author);
        return this.meta;
    }

    protected async initializeMetadata(author: Wallet, roles?) {
        this.meta = {
            id: this.id,
            version: Vault.CURRENT_VAULT_VERSION,
            created: new Date(),
            roles: roles || {},
            containers: {},
        };

        this.containers = {};

        this.logAction(author, 'initialize', { roles });

        await this.createRole(author, Vault.OWNERS_ROLE);
        await this.createRole(author, Vault.LEDGER_ROLE);

        this.getOrCreateLedger(author);

        return this.meta;
    }

    metadataHash() {
        return utils.objectHash(this.meta);
    }

    getVaultMetaFileUri() {
        return 'engine://' + path.join(this.auth.__id, this.id, Vault.METADATA_FILE_NAME);
    }

    getContainerMetadata(container: string) {
        return this.meta.containers[container] || {};
    }

    private getOrCreateLedger(author: Wallet) {
        return this.getOrCreateContainer(author, Vault.LEDGER_CONTAINER, 'external_file_ledger', {
            roles: [Vault.LEDGER_ROLE],
        });
    }

    async verify() {
        await this.loadMetadata();
        logger.info(`Verifying Vault ${this.id}`);
        for (const name in this.meta.containers) {
            if (this.containers.hasOwnProperty(name)) {
                const container: Container = this.containers[name];
                logger.info(`Verifying Vault ${this.id} Container ${name}`);
                if (!(await container.verify())) {
                    logger.error(`Verifying Vault ${this.id} Container ${name} Failed`);
                    return false;
                }
            }
        }
        const signatureVerification = utils.verifyHash(this.meta) && utils.verifySignature(this.meta.signed);

        if (!signatureVerification) {
            logger.error(`Verifying Vault ${this.id} Signature Failed`);
        } else {
            logger.info(`Verifying Vault ${this.id} Successful`);
        }

        return signatureVerification;
    }

    logAction(author: Wallet, action: string, params?: any, output?: any) {
        const payload = { action, params, output };
        const signed_payload = utils.signObject(author, payload);
        logger.info(`Vault ${this.id} Action ${action}`);
        return signed_payload;
    }

    async updateLedger(author: Wallet, payload: any) {
        const ledger = this.getOrCreateLedger(author);
        await ledger.addIndexedEntry(author, payload);
    }

    getCurrentRevision(author: Wallet): number {
        const ledger = this.getOrCreateLedger(author);
        return ledger.meta.nextIndex;
    }

    async getHistoricalDataBySequence(author: Wallet, container: string = null, sequence: number, subFile?: string) {
        return await this.containers[Vault.LEDGER_CONTAINER].decryptToIndex(
            author,
            container,
            sequence,
            subFile,
            false,
        );
    }

    async getHistoricalDataByDate(author: Wallet, container: string = null, date: string, subFile?: string) {
        return await this.containers[Vault.LEDGER_CONTAINER].decryptToDate(author, container, date, subFile);
    }

    async createRole(author: Wallet, role: string) {
        if (this.meta.roles[role]) return false;
        else this.meta.roles[role] = {};

        const role_identity = await Wallet.generate_identity();
        const encrypted_key = await Wallet.encrypt_to_string(author.public_key, role_identity.privateKey);
        this.meta.roles[role].public_key = role_identity.publicKey;

        this.logAction(author, 'create_role', { role });

        this.meta.roles[role][author.public_key] = encrypted_key;
    }

    authorized_for_role(public_key: string, role: string) {
        /* OWNERS_ROLE role is authorized for everything */
        if (this.meta.roles[Vault.OWNERS_ROLE] && this.meta.roles[Vault.OWNERS_ROLE][public_key]) return true;

        return !!(this.meta.roles[role] && this.meta.roles[role][public_key]);
    }

    authorized_roles(public_key: string) {
        const roles = [];

        // append OWNERS_ROLE first if we're an owner
        if (this.meta.roles[Vault.OWNERS_ROLE] && this.meta.roles[Vault.OWNERS_ROLE][public_key]) {
            roles.push(Vault.OWNERS_ROLE);
        }

        // append remaining roles we are authorized for
        for (const role in this.meta.roles) {
            if (role != Vault.OWNERS_ROLE && this.meta.roles[role][public_key]) {
                roles.push(role);
            }
        }

        return roles;
    }

    protected async __loadRoleKey(wallet: Wallet, role: string) {
        if (!this.authorized_for_role(wallet.public_key, role)) return false;
        return await wallet.decrypt_message(this.meta.roles[role][wallet.public_key]);
    }

    async decryptWithRoleKey(wallet: Wallet, role: string, message: any) {
        const key = await this.__loadRoleKey(wallet, role);
        if (!key) throw new Error('Role has no valid encryption key');
        return await Wallet.decrypt_with_raw_key(key, message);
    }

    async decryptMessage(wallet: Wallet, message: any) {
        const roles = this.authorized_roles(wallet.public_key);

        if (roles.length == 0) {
            throw new Error('Wallet has no access to contents');
        }

        for (const role of roles) {
            try {
                return await this.decryptWithRoleKey(wallet, role, message);
            } catch (err) {
                logger.debug(`Message decryption failed with role ${role} (${err.message})`);
            }
        }

        throw new Error('Wallet has no access to contents');
    }

    async compressContent(content: string | object): Promise<string> {
        let toCompress;
        if (typeof content === 'object') {
            toCompress = JSON.stringify(content);
        } else {
            toCompress = content;
        }
        return new Promise((resolve, reject) => {
            zlib.deflate(toCompress, (error, buffer) => {
                if (!error) {
                    resolve(buffer.toString('base64'));
                } else {
                    logger.error(`Unable to compress message: ${content}`);
                    reject(new Error('Unable to compress message'));
                }
            });
        });
    }

    async decompressContent(content: string): Promise<string> {
        let buffer;
        buffer = Buffer.from(content, 'base64');
        return new Promise((resolve, reject) => {
            zlib.unzip(buffer, (error, bufferResult) => {
                if (!error) {
                    resolve(bufferResult.toString());
                } else {
                    logger.error(`Unable to decompress message: ${content}`);
                    reject(new Error('Unable to decompress message'));
                }
            });
        });
    }

    async getContainerContent(content: any, name: string): Promise<Container> {
        let container;
        let contentObject: object;
        if (compareVersions.compare(this.meta.version, Vault.VAULT_VERSION__ZIP_CONTAINER, '>=')) {
            contentObject = JSON.parse(await this.decompressContent(content));
        } else {
            contentObject = content;
        }
        container = ContainerFactory.create(contentObject['container_type'], this, name, contentObject);
        return container;
    }

    async encryptForRole(role: string, message: any) {
        const public_key = this.meta.roles[role].public_key;
        return await Wallet.encrypt_to_string(public_key, message);
    }

    async authorize(author: Wallet, role: string, public_key: string, force_key?: string) {
        const auth_pub = author.public_key;
        if (!force_key && !this.authorized_for_role(auth_pub, role) && !this.authorized_for_role(auth_pub, role))
            return false;

        const encrypted_key = await Wallet.encrypt_to_string(public_key, await this.__loadRoleKey(author, role));

        this.meta.roles[role][public_key] = encrypted_key;

        this.logAction(author, 'authorize_key_for_role', { role, public_key }, { encrypted_key });

        return true;
    }

    async metadataFileExists() {
        return await this.fileExists(Vault.METADATA_FILE_NAME);
    }

    async loadMetadata() {
        let metaContent: object = {};
        try {
            const data = await this.getFile(Vault.METADATA_FILE_NAME);
            this.meta = await JSON.parse(data);

            if (compareVersions.compare(this.meta.version, Vault.CURRENT_VAULT_VERSION, '>')) {
                throw new Error(
                    `Vault version is not supported by this Engine.` +
                        `[${this.meta.version}] > [${Vault.CURRENT_VAULT_VERSION}]`,
                );
            }

            this.containers = {};
            for (const name in this.meta.containers) {
                this.containers[name] = await this.getContainerContent(this.meta.containers[name], name);
                metaContent[name] = this.containers[name].meta;
            }

            this.meta.containers = metaContent;
            return this.meta;
        } catch (_err) {
            if (_err instanceof DriverError) {
                throw new Error(`Unable to load vault from Storage driver '${_err.errorState}'`);
            }

            if (_err instanceof SyntaxError) {
                throw new Error('Unable to parse vault metadata');
            }

            throw _err;
        }
    }

    async writeMetadata(author: Wallet): Promise<VaultWriteResponse> {
        logger.info(`Writing Vault ${this.id} Metadata`);
        this.meta.version = Vault.CURRENT_VAULT_VERSION;
        await this.updateContainerMetadata(author);
        this.meta = utils.signObject(author, this.meta);
        for (const name in this.meta.containers) {
            this.meta.containers[name] = await this.compressContent(this.meta.containers[name]);
        }
        await this.putFile(Vault.METADATA_FILE_NAME, utils.stringify(this.meta));
        return {
            vault_signed: this.meta.signed,
            vault_revision: this.getCurrentRevision(author),
        };
    }

    async deleteEverything() {
        await this.removeDirectory(null, true);
    }

    async updateContainerMetadata(author: Wallet) {
        this.meta.containers = {};
        for (const name in this.containers) {
            if (this.containers.hasOwnProperty(name)) {
                const container = this.containers[name];
                this.meta.containers[name] = await container.buildMetadata(author);
            }
        }
    }

    async fileExists(filePath: string) {
        return await ResourceLock(this.id, this.driver, 'fileExists', [filePath]);
    }

    async getFile(filePath: string) {
        return await ResourceLock(this.id, this.driver, 'getFile', [filePath]);
    }

    async putFile(filePath: string, fileData: any) {
        return await ResourceLock(this.id, this.driver, 'putFile', [filePath, fileData]);
    }

    async removeFile(filePath: string) {
        return await ResourceLock(this.id, this.driver, 'removeFile', [filePath]);
    }

    async removeDirectory(directoryPath: string, recursive?: boolean) {
        return await ResourceLock(this.id, this.driver, 'removeDirectory', [directoryPath, recursive]);
    }

    async listDirectory(vaultDirectory: string, recursive?: boolean, errorOnEmpty?: boolean) {
        return await ResourceLock(this.id, this.driver, 'listDirectory', [vaultDirectory, recursive, errorOnEmpty]);
    }

    getOrCreateContainer(author: Wallet, name: string, container_type?: string, meta?: any) {
        if (this.containers[name] instanceof Container) return this.containers[name];
        this.logAction(author, 'create_container', { name, container_type });
        const container = ContainerFactory.create(container_type || 'embedded_file', this, name, meta);
        this.containers[name] = container;
        return container;
    }
}

interface VaultWriteResponse {
    vault_signed: utils.Signature;
    vault_revision: number;
}
