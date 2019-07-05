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
import { Wallet } from '../entity/Wallet';
import { ResourceLock } from '../redis';
import * as path from 'path';
import * as utils from '../utils';
import { Logger } from '../Logger';

import zlib from 'zlib';
import compareVersions from 'compare-versions';

// Import Moment Typings and Functions
import { Moment } from 'moment';
import moment from 'moment';

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

        logger.info(`Instantiating Vault ${this.id} using ${auth.driver_type} driver`);
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
        container = Container.typeFactory(contentObject['container_type'], this, name, contentObject);
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

    async writeMetadata(author: Wallet) {
        logger.info(`Writing Vault ${this.id} Metadata`);
        this.meta.version = Vault.CURRENT_VAULT_VERSION;
        await this.updateContainerMetadata(author);
        this.meta = utils.signObject(author, this.meta);
        for (const name in this.meta.containers) {
            this.meta.containers[name] = await this.compressContent(this.meta.containers[name]);
        }
        await this.putFile(Vault.METADATA_FILE_NAME, utils.stringify(this.meta));
        return this.meta.signed;
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
        const container = Container.typeFactory(container_type || 'embedded_file', this, name, meta);
        this.containers[name] = container;
        return container;
    }
}

export abstract class Container {
    public vault: Vault;
    public name: string;
    public meta: any;
    public container_type: string;
    protected modified_raw_contents: boolean = false;

    protected constructor(vault: Vault, name: string, meta?: any) {
        this.vault = vault;
        this.name = name;
        this.meta = meta || {
            roles: [Vault.OWNERS_ROLE],
        };
    }

    static typeFactory(container_type: string, vault: Vault, name: string, meta?: any) {
        // Embedded
        if (container_type == 'embedded_file') return new EmbeddedFileContainer(vault, name, meta);
        if (container_type == 'embedded_list') return new EmbeddedListContainer(vault, name, meta);

        // External Files
        if (container_type == 'external_file') return new ExternalFileContainer(vault, name, meta);
        if (container_type == 'external_file_multi') return new ExternalFileMultiContainer(vault, name, meta);

        // External Lists
        if (container_type == 'external_list') return new ExternalListContainer(vault, name, meta);
        if (container_type == 'external_list_daily') return new ExternalListDailyContainer(vault, name, meta);

        // External Ledger
        if (container_type == 'external_file_ledger') return new ExternalFileLedgerContainer(vault, name, meta);

        throw new Error("Unknown Container type: '" + container_type + "'");
    }

    // authorize_role(author: Wallet, role: string) {
    //     this.meta.roles.push(role);
    //     // Adding a role to a Container will need to re-encrypt the data for the new key
    //     this.vault.logAction(author, 'container.authorize_role', {
    //         role,
    //         container_type: this.container_type,
    //         name: this.name,
    //     });
    // }

    abstract async encryptContents();

    abstract async decryptContents(user: Wallet);

    abstract async buildMetadata(author: Wallet);

    abstract async verify();

    async updateLedger(author: Wallet, action: string, params?: any, output?: any) {
        if (this.name === Vault.LEDGER_CONTAINER) {
            return;
        }
        return await this.vault.updateLedger(author, {
            action: 'container.' + this.container_type + '.' + action,
            name: this.name,
            params,
            output,
        });
    }
}

interface ListContentContainer {
    append(author: Wallet, blob: any);
}
interface SingleContentContainer {
    setContents(author: Wallet, blob: any);
}
interface MultiContentContainer {
    setSingleContent(author: Wallet, fileName: string, blob: any);
    listFiles();
}

export abstract class EmbeddedContainer extends Container {
    public container_type: string;
    public raw_contents: any = null;
    public encrypted_contents: any = null;

    protected constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = meta && meta.encrypted_contents ? meta.encrypted_contents : {};
    }

    abstract getRawContents();

    async encryptContents() {
        if (this.modified_raw_contents || Object.keys(this.encrypted_contents).length === 0) {
            const unencrypted = this.getRawContents();
            this.encrypted_contents = {};

            for (const idx in this.meta.roles) {
                const role = this.meta.roles[idx];
                try {
                    this.encrypted_contents[role] = await this.vault.encryptForRole(role, unencrypted);
                } catch (_err) {
                    throw new Error('Unable to encrypt vault data (' + _err.message + ')');
                }
            }
        }

        return this.encrypted_contents;
    }

    async decryptContents(user: Wallet) {
        const roles = this.vault.authorized_roles(user.public_key);

        for (const role of roles) {
            if (role && this.encrypted_contents[role]) {
                logger.debug(`Vault ${this.vault.id} Decrypting Container ${this.name} with role ${role}`);

                let decrypted_contents;

                try {
                    decrypted_contents = await this.vault.decryptWithRoleKey(user, role, this.encrypted_contents[role]);
                } catch (_err) {
                    throw new Error('Unable to decrypt vault data (' + _err.message + ')');
                }

                if (
                    decrypted_contents === null ||
                    decrypted_contents === undefined ||
                    decrypted_contents == [] ||
                    decrypted_contents == {}
                ) {
                    throw new Error('Container contents empty');
                }
                return decrypted_contents;
            } else {
                logger.debug(
                    `Vault ${this.vault.id} Decrypting Container ${this.name} has no content for role ${role}`,
                );
            }
        }

        throw new Error('Unauthorized access to vault contents');
    }

    async verify() {
        // Embedded containers are verified via the main metadata signature
        return true;
    }

    async buildMetadata(author: Wallet) {
        let metadata = this.meta;
        metadata.container_type = this.container_type;
        metadata.encrypted_contents = await this.encryptContents();
        return metadata;
    }
}

export class EmbeddedFileContainer extends EmbeddedContainer implements SingleContentContainer {
    public container_type: string = 'embedded_file';

    constructor(vault: Vault, name: string, meta?) {
        super(vault, name, meta);
        this.raw_contents = [];
    }

    async setContents(author: Wallet, blob: any) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        this.raw_contents = blob;
        this.modified_raw_contents = true;
        const hash = utils.objectHash(blob);
        await this.updateLedger(author, 'setcontents', blob, { hash });
    }

    getRawContents() {
        return this.raw_contents;
    }
}

export class EmbeddedListContainer extends EmbeddedContainer implements ListContentContainer {
    public container_type: string = 'embedded_list';

    constructor(vault: Vault, name: string, meta?) {
        super(vault, name, meta);
        this.raw_contents = [];
    }

    async append(author: Wallet, blob) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        const hash = utils.objectHash(blob);
        if (!this.raw_contents.length && Object.keys(this.encrypted_contents).length) {
            await this.decryptContents(author);
        }
        this.raw_contents.push(blob);
        this.modified_raw_contents = true;
        await this.updateLedger(author, 'append', blob, { hash });
    }

    getRawContents() {
        return utils.stringify(this.raw_contents);
    }

    async decryptContents(user: Wallet) {
        const decrypted = await super.decryptContents(user);

        try {
            this.raw_contents = JSON.parse(decrypted);
            this.modified_raw_contents = true;
            return this.raw_contents;
        } catch (_err) {
            throw new Error('Unable to parse decrypted vault contents');
        }
    }
}

export abstract class ExternalContainer extends Container {
    public container_type: string;
    public raw_contents: any = null;
    public encrypted_contents: any = null;

    protected constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = null;
        this.raw_contents = [];
    }

    protected getRawContents(contentIndex?: string) {
        if (contentIndex) {
            return this.raw_contents[contentIndex];
        }
        return this.raw_contents;
    }

    protected getEncryptedContents(contentIndex?: string) {
        if (contentIndex) {
            return this.encrypted_contents[contentIndex];
        }
        return this.encrypted_contents;
    }

    protected setEncryptedContents(contents: any, subFile?: string) {
        if (subFile) {
            if (!this.encrypted_contents) {
                this.encrypted_contents = {};
            }
            this.encrypted_contents[subFile] = contents;
        } else {
            this.encrypted_contents = contents;
        }
    }

    protected getExternalFilename(subFile?: string) {
        if (subFile) {
            return path.join(this.name, subFile + '.json');
        }
        return this.name + '.json';
    }

    async loadEncryptedFileContents(subFile?: string) {
        let contentsLoaded: boolean = false;

        // Only load encrypted contents from the file if we don't have it already. `vault.getFile` can be expensive
        if (this.encrypted_contents) {
            contentsLoaded = true;
        }

        if (contentsLoaded && subFile) {
            contentsLoaded = this.encrypted_contents[subFile];
        }

        if (!contentsLoaded) {
            try {
                let file_contents = await this.vault.getFile(this.getExternalFilename(subFile));
                this.setEncryptedContents(JSON.parse(file_contents), subFile);
            } catch (_err) {
                this.setEncryptedContents({}, subFile);
            }
        }
    }

    protected async writeEncryptedFileContents(author: Wallet, subFile?: string) {
        let file_contents = JSON.stringify(this.getEncryptedContents(subFile));
        await this.vault.putFile(this.getExternalFilename(subFile), file_contents);
        return utils.objectSignature(author, file_contents);
    }

    async encryptContents(subFile?: string) {
        const unencrypted = this.getRawContents(subFile);

        this.setEncryptedContents({}, subFile);

        for (const idx in this.meta.roles) {
            const role = this.meta.roles[idx];

            try {
                const _encrypted_data = await this.vault.encryptForRole(role, unencrypted);

                if (subFile) {
                    this.encrypted_contents[subFile][role] = _encrypted_data;
                } else {
                    this.encrypted_contents[role] = _encrypted_data;
                }
            } catch (_err) {
                throw new Error('Unable to encrypt vault data (' + _err.message + ')');
            }
        }
    }

    async decryptContents(user: Wallet, subFile?: string) {
        const roles = this.vault.authorized_roles(user.public_key);

        await this.loadEncryptedFileContents(subFile);
        const encrypted = this.getEncryptedContents(subFile);

        for (const role of roles) {
            if (role && encrypted && encrypted[role]) {
                logger.debug(
                    `Vault ${this.vault.id} Decrypting Ext Container ${this.name} with role ${role} [${subFile}]`,
                );
                let decrypted_contents;

                try {
                    decrypted_contents = await this.vault.decryptWithRoleKey(user, role, encrypted[role]);
                } catch (_err) {
                    throw new Error('Unable to decrypt vault data (' + _err.message + ')');
                }

                if (
                    decrypted_contents === null ||
                    decrypted_contents === undefined ||
                    decrypted_contents == [] ||
                    decrypted_contents == {}
                ) {
                    throw new Error('Container contents empty');
                }
                return decrypted_contents;
            } else {
                logger.debug(
                    `Vault ${this.vault.id} Decrypting Ext Container ${
                        this.name
                    } has no content for role ${role} [${subFile}]`,
                );
            }
        }

        throw new Error('Unauthorized access to vault contents');
    }

    async verify(subFile?: string) {
        const external_file_name = this.getExternalFilename(subFile);
        const file_contents = await this.vault.getFile(external_file_name);

        const container_meta = this.vault.getContainerMetadata(this.name);
        const container_signature = container_meta[external_file_name];

        const rebuilt_object = { ...JSON.parse(file_contents), signed: container_signature };

        return utils.verifyHash(rebuilt_object) && utils.verifySignature(container_signature);
    }

    async buildMetadata(author: Wallet, subFile?: string) {
        // Only build metadata if we've modified the contents or if this is a new vault.
        // check fileExists last to prevent it from being called if we DO modify data
        if (this.modified_raw_contents || !(await this.vault.fileExists(this.getExternalFilename(subFile)))) {
            const containerKey = this.getExternalFilename(subFile);
            await this.encryptContents(subFile);

            let metadata = this.meta;
            metadata.container_type = this.container_type;
            metadata[containerKey] = await this.writeEncryptedFileContents(author, subFile);

            return metadata;
        } else {
            return this.meta;
        }
    }
}

export class ExternalFileContainer extends ExternalContainer implements SingleContentContainer {
    public container_type: string = 'external_file';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
    }

    async setContents(author: Wallet, blob: any) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        this.raw_contents = blob;
        this.modified_raw_contents = true;
        const hash = utils.objectHash(blob);
        await this.updateLedger(author, 'setcontents', blob, { hash });
    }
}

export class ExternalListContainer extends ExternalContainer implements ListContentContainer {
    public container_type: string = 'external_list';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
    }

    async append(author: Wallet, blob) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        const hash = utils.objectHash(blob);
        if (!this.raw_contents.length && this.meta[this.getExternalFilename()]) {
            await this.decryptContents(author);
        }

        this.raw_contents.push(blob);
        this.modified_raw_contents = true;
        await this.updateLedger(author, 'append', blob, { hash });
    }

    getRawContents() {
        return utils.stringify(this.raw_contents);
    }

    async decryptContents(user: Wallet) {
        const decrypted = await super.decryptContents(user);

        try {
            return (this.raw_contents = JSON.parse(decrypted));
        } catch (_err) {
            throw new Error('Unable to parse decrypted vault contents');
        }
    }
}

export abstract class ExternalDirectoryContainer extends ExternalContainer {
    protected modified_items: string[] = [];

    protected constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = null;
        this.raw_contents = {};
    }

    async encryptContents() {
        for (let property of this.modified_items) {
            if (this.raw_contents.hasOwnProperty(property)) {
                await super.encryptContents(property);
            }
        }
    }

    async decryptContents(user: Wallet, fileName: string) {
        const decrypted = await super.decryptContents(user, fileName);
        return (this.raw_contents[fileName] = decrypted);
    }

    async buildMetadata(author: Wallet) {
        await this.encryptContents();

        let external_file_signatures = {};

        for (let property of this.modified_items) {
            let container_key = this.getExternalFilename(property);
            external_file_signatures[container_key] = await this.writeEncryptedFileContents(author, property);
        }

        let metadata = {
            ...this.meta,
            ...external_file_signatures,
        };

        metadata.container_type = this.container_type;

        return metadata;
    }

    async verify() {
        let all_verified = true;

        for (let property in this.meta) {
            if (this.meta.hasOwnProperty(property) && property.indexOf(this.name) !== -1) {
                // Remove the container name from the property
                let desiredItem = property.split(path.sep)[1];

                // Remove the file extension from the property
                desiredItem = desiredItem.slice(0, desiredItem.lastIndexOf('.'));

                if (!(await super.verify(desiredItem))) {
                    all_verified = false;
                }
            }
        }

        return all_verified;
    }
}

export class ExternalListDailyContainer extends ExternalDirectoryContainer implements ListContentContainer {
    public container_type: string = 'external_list_daily';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
    }

    static getCurrentDayProperty(): string {
        let today = new Date();
        return (
            today.getUTCFullYear() + ('0' + (today.getUTCMonth() + 1)).slice(-2) + ('0' + today.getUTCDate()).slice(-2)
        );
    }

    async append(author: Wallet, blob) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        let todaysProperty = ExternalListDailyContainer.getCurrentDayProperty();

        const hash = utils.objectHash(blob);

        if (!this.raw_contents.hasOwnProperty(todaysProperty) && this.meta[this.getExternalFilename(todaysProperty)]) {
            await this.decryptContents(author, todaysProperty);
        }

        if (!this.raw_contents.hasOwnProperty(todaysProperty)) {
            this.raw_contents[todaysProperty] = [];
        }

        this.raw_contents[todaysProperty].push(blob);
        this.modified_items.push(todaysProperty);
        await this.updateLedger(author, 'append', blob, { hash });
    }

    getRawContents(subFile?: string) {
        return utils.stringify(super.getRawContents(subFile));
    }

    async decryptContents(user: Wallet, day?: string) {
        if (day) {
            return this.decryptDayContents(user, day);
        } else {
            return this.decryptAllContents(user);
        }
    }

    async decryptDayContents(user: Wallet, day: string) {
        const decrypted = await super.decryptContents(user, day);

        try {
            return (this.raw_contents[day] = JSON.parse(decrypted));
        } catch (_err) {
            throw new Error('Unable to parse decrypted vault contents');
        }
    }

    async decryptAllContents(user: Wallet) {
        let all_contents = [];

        for (let property in this.meta) {
            if (this.meta.hasOwnProperty(property) && property.indexOf(this.name) !== -1) {
                // Remove the container name from the property
                let desired_day = property.split(path.sep)[1];

                // Remove the file extension from the property
                desired_day = desired_day.slice(0, desired_day.lastIndexOf('.'));

                let day_data = await this.decryptDayContents(user, desired_day);
                all_contents = all_contents.concat(day_data);
            }
        }

        return all_contents;
    }
}

export class ExternalFileMultiContainer extends ExternalDirectoryContainer implements MultiContentContainer {
    public container_type: string = 'external_file_multi';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
    }

    async setSingleContent(author: Wallet, fileName: string, blob: any) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        this.raw_contents[fileName] = blob;
        this.modified_items.push(fileName);
        const hash = utils.objectHash(blob);
        await this.updateLedger(author, 'setsinglecontent', { fileName: fileName, blob: blob }, { hash });
    }

    async listFiles() {
        const fileList = (await this.vault.listDirectory(this.name, null, false)).files;
        for (let file of fileList) {
            file.name = file.name.replace(/.json$/, '');
        }
        return fileList;
    }
}

class LedgerEntry {
    public type: string;
    public action: string;
    public name: string;

    constructor(type: string, action: string, name: string) {
        this.type = type;
        this.action = action;
        this.name = name;
    }

    public static fromIndexData(indexData: any): LedgerEntry {
        const action = indexData.action.split('.');
        const containerType = action[1];
        const containerAction = action[2];
        return new LedgerEntry(containerType, containerAction, indexData.name);
    }

    public isFileContainer(): Boolean {
        return this.type.indexOf('_file') != -1;
    }

    public isListContainer(): Boolean {
        return this.type.indexOf('_list') != -1;
    }

    public isMultiFileContainer(): Boolean {
        return this.isFileContainer() && this.type.indexOf('_multi') != -1;
    }

    public isSingleFileContainer(): Boolean {
        return this.isFileContainer() && this.type.indexOf('_multi') == -1;
    }

    public isMultiFileSetContentAction(): Boolean {
        return this.isMultiFileContainer() && this.action.indexOf('setsinglecontent') != -1;
    }

    public isSingleFileSetContentAction(): Boolean {
        return this.isSingleFileContainer() && this.action.indexOf('setcontents') != -1;
    }

    public isListAppendAction(): Boolean {
        return this.isListContainer() && this.action.indexOf('append') != -1;
    }
}

export class ExternalFileLedgerContainer extends ExternalFileMultiContainer {
    public container_type: string = 'external_file_ledger';
    private nextIndex: number;
    private static readonly INDEX_PADDING: number = 7;
    public static readonly MOMENT_FORMAT: string = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.nextIndex = meta && meta.nextIndex ? meta.nextIndex : 1;
    }

    private paddedIndex(index: number = this.nextIndex): string {
        let paddedIndex: string = index + '';
        while (paddedIndex.length < ExternalFileLedgerContainer.INDEX_PADDING) {
            paddedIndex = '0' + paddedIndex;
        }
        return paddedIndex;
    }

    async addIndexedEntry(author: Wallet, blob: any) {
        await super.setSingleContent(author, this.paddedIndex(), JSON.stringify(blob));
        this.nextIndex = this.nextIndex + 1;
    }

    private static getFileContent(
        ledgerEntry: LedgerEntry,
        indexData: any,
        decryptedContainers: any,
        subFile?: string,
    ) {
        let foundApplicableData = false;

        // Multi-file containers
        if (ledgerEntry.isMultiFileSetContentAction()) {
            if (!decryptedContainers[ledgerEntry.name]) {
                decryptedContainers[ledgerEntry.name] = {};
            }

            if (subFile) {
                if (subFile === indexData.params.fileName) {
                    decryptedContainers[ledgerEntry.name][subFile] = indexData.params.blob;
                    foundApplicableData = true;
                }
            } else {
                decryptedContainers[ledgerEntry.name][indexData.params.fileName] = indexData.params.blob;
                foundApplicableData = true;
            }
        }

        // Single-file containers
        else if (ledgerEntry.isSingleFileSetContentAction()) {
            decryptedContainers[ledgerEntry.name] = indexData.params;
            foundApplicableData = true;
        }

        return [foundApplicableData, decryptedContainers];
    }

    async decryptToIndex(
        user: Wallet,
        container: string = null,
        index: number = this.nextIndex - 1,
        subFile?: string,
        approximateIndex: boolean = true,
    ) {
        let foundApplicableData: boolean = false;
        let decryptedContainers = {};
        let ledgerEntry: LedgerEntry = null;

        // If container type is a file, then go straight to index
        if (!approximateIndex && container && this.vault.containers[container].container_type.indexOf('_file') != -1) {
            let indexData = await this.decryptContents(user, this.paddedIndex(+index));
            indexData = JSON.parse(indexData);

            ledgerEntry = LedgerEntry.fromIndexData(indexData);

            if (container != ledgerEntry.name) {
                throw new Error(`Ledger data at index ${index} is not for container ${container}`);
            }

            [foundApplicableData, decryptedContainers] = ExternalFileLedgerContainer.getFileContent(
                ledgerEntry,
                indexData,
                decryptedContainers,
                subFile,
            );
        }

        // Otherwise we'll have to rebuild one by one
        else {
            for (let desiredIndex = 1; desiredIndex <= index && desiredIndex < this.nextIndex; desiredIndex++) {
                let foundApplicableDataAtIndex = false;
                let indexData = await this.decryptContents(user, this.paddedIndex(+desiredIndex));
                indexData = JSON.parse(indexData);

                ledgerEntry = LedgerEntry.fromIndexData(indexData);

                if (!container || ledgerEntry.name === container) {
                    // Rebuild File containers
                    if (ledgerEntry.isFileContainer()) {
                        [foundApplicableDataAtIndex, decryptedContainers] = ExternalFileLedgerContainer.getFileContent(
                            ledgerEntry,
                            indexData,
                            decryptedContainers,
                            subFile,
                        );
                    }

                    // Rebuild List containers
                    else if (ledgerEntry.isListContainer()) {
                        if (!decryptedContainers[container]) {
                            decryptedContainers[container] = [];
                        }
                        if (ledgerEntry.isListAppendAction()) {
                            decryptedContainers[container].push(indexData.params);
                            foundApplicableDataAtIndex = true;
                        }
                    }
                }

                foundApplicableData = foundApplicableData || foundApplicableDataAtIndex;
            }
        }

        if (!foundApplicableData) {
            throw new Error(`No data found at specific sequence`);
        }

        return decryptedContainers;
    }

    async decryptToDate(user: Wallet, container: string = null, date: string, subFile?: string) {
        const toDate: Moment = moment(date, [ExternalFileLedgerContainer.MOMENT_FORMAT, moment.ISO_8601], true).add(
            1,
            'ms',
        );

        if (!toDate.isValid()) {
            throw new Error(`Invalid Date '${date}' not in format '${ExternalFileLedgerContainer.MOMENT_FORMAT}'`);
        }

        let toIndex = -1;
        let onDate: string;

        // Find the latest Ledger index before our toDate
        for (let property in this.meta) {
            if (this.meta.hasOwnProperty(property) && property.indexOf(this.name) !== -1) {
                const indexDate: Moment = moment(
                    this.meta[property].at,
                    [ExternalFileLedgerContainer.MOMENT_FORMAT, moment.ISO_8601],
                    true,
                );
                if (!indexDate.isValid()) {
                    throw new Error(`Vault Ledger data is invalid! [${container}.${property}]`);
                }

                if (indexDate.isBefore(toDate)) {
                    // Remove the container name from the property
                    let thisIndex = property.split(path.sep)[1];

                    // Remove the file extension from the property
                    thisIndex = thisIndex.slice(0, thisIndex.lastIndexOf('.'));

                    toIndex = +thisIndex;
                    onDate = this.meta[property].at;
                } else {
                    break;
                }
            }
        }

        if (toIndex == -1) {
            throw new Error(`No data found for date`);
        }

        try {
            return {
                on_date: onDate,
                ...(await this.decryptToIndex(user, container, toIndex, subFile)),
            };
        } catch (err) {
            throw new Error(`No data found for date`);
        }
    }

    async buildMetadata(author: Wallet) {
        const metadata = await super.buildMetadata(author);
        metadata.nextIndex = this.nextIndex;
        return metadata;
    }
}
