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
import { EncryptionMethod, Wallet } from '../entity/Wallet';

import { ResourceLock } from '../redis';
import * as path from 'path';
import * as utils from '../utils';
import { Logger } from '../Logger';

import zlib from 'zlib';
import compareVersions from 'compare-versions';

const logger = Logger.get(module.filename);

/*                         Vault Encryption
 *                   ============================
 * Data within Vaults is encrypted using envelope encryption.
 * When a Container is first initialized in a Vault, an encryption key
 * is generated for that role. All data in that container will be
 * encrypted with that role key. Each user (Wallet) that is granted
 * access to that Container will not have a full copy of the data
 * encrypted with their own private key -- the data encryption key will
 * be encrypted with their private key, and they will use their own
 * private key to decrypt the data encryption key, granting them access
 * to decrypt the actual container data.
 *
 * Prior to Vault version 0.0.3, both layers of encryption were handled
 * with eth-crypto (secp256k1/aes-256-cbc). This algorithm and key
 * derivation were selected as that is how the public keys and addresses
 * are calculated in the Ethereum ecosystem.
 *
 * This works fine for Wallets hosted in Engine where we have access to
 * the private key for decryption. But looking forward to Vault data
 * being accessed via a browser with an extension like Metamask, there
 * is no way to access the private key for decrypting the data encryption
 * key. Metamask recently included support for message encryption and
 * decryption utilizing eth-sig-util (x25519-xsalsa20-poly1305). We don't
 * need to change the encryption key for each role to take advantage of
 * metamask encryption/decryption. We only need to change the outer layer
 * of the envelope encryption. Vault version 0.0.3 implements this change.
 *
 */

export class Vault {
    protected driver: StorageDriver;
    protected auth;
    public id;
    public containers;
    protected meta;

    private static readonly METADATA_FILE_NAME = 'meta.json';
    private static readonly NACL_PREFIX = 'nacl:';
    static readonly VAULT_VERSION__INITIAL = '0.0.1';
    static readonly VAULT_VERSION__ZIP_CONTAINER = '0.0.2';
    static readonly VAULT_VERSION__NACL_OUTER_ENCRYPTION = '0.0.3';
    static readonly CURRENT_VAULT_VERSION = Vault.VAULT_VERSION__NACL_OUTER_ENCRYPTION;
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

    protected async initializeMetadata(author: Wallet, additionalMeta?: any) {
        this.meta = {
            id: this.id,
            version: Vault.CURRENT_VAULT_VERSION,
            created: new Date(),
            roles: {},
            containers: {},
        };

        this.meta = Object.assign(this.meta, additionalMeta);

        this.containers = {};

        this.logAction(author, 'initialize', {});

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
            sequence === null || sequence === undefined,
        );
    }

    async getHistoricalDataByDate(author: Wallet, container: string = null, date: string, subFile?: string) {
        return await this.containers[Vault.LEDGER_CONTAINER].decryptToDate(author, container, date, subFile);
    }

    private async setRoleAuthorization(roleUser: Wallet, role: string, privateKey: string): Promise<string> {
        // Outer layer encryption is performed with NaCl as of VAULT_VERSION__NACL_OUTER_ENCRYPTION
        const encrypted_key = await Wallet.encrypt({
            message: privateKey,
            wallet: roleUser,
            method: EncryptionMethod.NaCl,
        });
        this.meta.roles[role][roleUser.public_key] = `${Vault.NACL_PREFIX}${encrypted_key}`;

        return encrypted_key;
    }

    async createRole(author: Wallet, role: string) {
        if (this.meta.roles[role]) return false;
        else this.meta.roles[role] = {};

        const role_identity = await Wallet.generate_identity();
        await this.setRoleAuthorization(author, role, role_identity.privateKey);
        this.meta.roles[role].public_key = role_identity.publicKey;

        this.logAction(author, 'create_role', { role });
    }

    authorized_for_role(public_key: string, role: string) {
        /* OWNERS_ROLE role is authorized for everything */
        if (this.meta.roles[Vault.OWNERS_ROLE] && this.meta.roles[Vault.OWNERS_ROLE][public_key]) return true;

        return !!(this.meta.roles[role] && this.meta.roles[role][public_key]);
    }

    authorized_roles(public_key: string): string[] {
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
        if (!this.authorized_for_role(wallet.public_key, role)) {
            return null;
        }

        let encryptionMethod: EncryptionMethod = EncryptionMethod.EthCrypto;
        let encryptedData = this.meta.roles[role][wallet.public_key];

        if (compareVersions.compare(this.meta.version, Vault.VAULT_VERSION__NACL_OUTER_ENCRYPTION, '>=')) {
            if (encryptedData.startsWith(Vault.NACL_PREFIX)) {
                encryptedData = encryptedData.slice(Vault.NACL_PREFIX.length);
                encryptionMethod = EncryptionMethod.NaCl;
            }
        }

        return await Wallet.decrypt({
            message: encryptedData,
            wallet: wallet,
            method: encryptionMethod,
        });
    }

    async decryptWithRoleKey(wallet: Wallet, role: string, message: any) {
        const key = await this.__loadRoleKey(wallet, role);
        if (!key) throw new Error('Role has no valid encryption key');
        return await Wallet.decrypt({ message: message, privateKey: key, method: EncryptionMethod.EthCrypto });
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

    private async compressContent(content: string | object): Promise<string> {
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

    private async decompressContent(content: string): Promise<string> {
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

    protected async decompressContainerMeta(content: any): Promise<any> {
        if (compareVersions.compare(this.meta.version, Vault.VAULT_VERSION__ZIP_CONTAINER, '>=')) {
            return JSON.parse(await this.decompressContent(content));
        } else {
            return content;
        }
    }

    async getContainerContent(content: any, name: string): Promise<Container> {
        let contentObject: object = await this.decompressContainerMeta(content);
        return ContainerFactory.create(contentObject['container_type'], this, name, contentObject);
    }

    async encryptForRole(role: string, message: any) {
        const public_key = this.meta.roles[role].public_key;
        // Inner layer encryption is performed with EthCrypto
        return await Wallet.encrypt({
            message: message,
            publicKey: public_key,
            method: EncryptionMethod.EthCrypto,
        });
    }

    async authorize(author: Wallet, role: string, walletToAuthorize: Wallet, force_key?: string) {
        const auth_pub = author.public_key;
        if (!force_key && !this.authorized_for_role(auth_pub, role) && !this.authorized_for_role(auth_pub, role))
            return false;

        const encrypted_key = await this.setRoleAuthorization(
            walletToAuthorize,
            role,
            await this.__loadRoleKey(author, role),
        );

        this.logAction(
            author,
            'authorize_key_for_role',
            { role, public_key: walletToAuthorize.public_key },
            { encrypted_key },
        );

        return true;
    }

    private async upgradeAuthorizationEncryption(author: Wallet) {
        /* VAULT_VERSION__NACL_OUTER_ENCRYPTION is updating the outer layer encryption method.
         * We are handling this upgrade with a lazy migration to avoid re-processing all existing vaults.
         * As vaults are saved, the authorization for that user will be upgraded in any roles they have access to.
         */
        for (let role of this.authorized_roles(author.public_key)) {
            if (!this.meta.roles[role][author.public_key].startsWith(Vault.NACL_PREFIX)) {
                await this.setRoleAuthorization(author, role, await this.__loadRoleKey(author, role));
            }
        }
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
        await this.upgradeAuthorizationEncryption(author);
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
