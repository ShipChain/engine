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
import { ResourceLock } from "../redis";
import * as path from 'path';
import * as utils from '../utils';

export class Vault {
    protected driver: StorageDriver;
    protected auth;
    public id;
    public containers;
    protected meta;

    private static readonly METADATA_FILE_NAME = 'meta.json';

    constructor(auth: any, id?: string) {
        this.id = id || utils.uuidv4();

        this.auth = {
            ...auth,
            base_path: path.join(auth.base_path || './', this.id),
        };

        this.driver = StorageDriverFactory.create(this.auth);
    }

    async getOrCreateMetadata(author: Wallet) {
        if (await this.metadataFileExists()) {
            return await this.loadMetadata();
        }

        await this.initializeMetadata(author);
        await this.writeMetadata(author);
        return this.meta;
    }

    async initializeMetadata(author: Wallet, roles?) {
        this.meta = {
            id: this.id,
            version: '0.0.1',
            created: new Date(),
            roles: roles || {},
            containers: {},
            actions: [],
        };

        this.containers = {};

        this.logAction(author, 'initialize', { roles });

        await this.createRole(author, 'owners');

        return this.meta;
    }

    metadataHash() {
        return utils.objectHash(this.meta);
    }

    getContainerMetadata(container: string) {
        return this.meta.containers[container] || {};
    }

    async verify() {
        for (const name in this.meta.containers) {
            if (this.containers.hasOwnProperty(name)) {
                const container: Container = this.containers[name];
                if (!(await container.verify())) {
                    return false;
                }
            }
        }
        return utils.verifyHash(this.meta) && utils.verifySignature(this.meta.signed);
    }

    logAction(author: Wallet, action: string, params?: any, output?: any) {
        const payload = { action, params, output };
        const signed_payload = utils.signObject(author, payload);
        this.meta.actions.push(signed_payload);
        return signed_payload;
    }

    async createRole(author: Wallet, role: string) {
        if (this.meta.roles[role]) return false;
        else this.meta.roles[role] = {};

        const role_identity = await Wallet.generate_identity();
        const encrypted_key = await Wallet.encrypt(author.public_key, role_identity.privateKey);
        this.meta.roles[role].public_key = role_identity.publicKey;

        this.logAction(author, 'create_role', { role });

        this.meta.roles[role][author.public_key] = encrypted_key.to_string;
    }

    authorized_for_role(public_key: string, role: string) {
        /* "owners" role is authorized for everything */
        if (this.meta.roles.owners && this.meta.roles.owners[public_key]) return true;

        return !!(this.meta.roles[role] && this.meta.roles[role][public_key]);
    }

    authorized_role(public_key: string) {
        /* return "owners" first if we're an owner" */
        if (this.meta.roles.owners && this.meta.roles.owners[public_key]) return 'owners';

        /* or return the first role we are authorized for... */
        for (const role in this.meta.roles) {
            if (this.meta.roles[role][public_key]) return role;
        }
        return false;
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
        const role = this.authorized_role(wallet.public_key);
        if (!role) throw new Error('Wallet has no access to contents');
        return await this.decryptWithRoleKey(wallet, role, message);
    }

    async encryptForRole(role: string, message: any) {
        const public_key = this.meta.roles[role].public_key;
        return await Wallet.encrypt(public_key, message);
    }

    async authorize(author: Wallet, role: string, public_key: string, force_key?: string) {
        const auth_pub = author.public_key;
        if (!force_key && !this.authorized_for_role(auth_pub, role) && !this.authorized_for_role(auth_pub, role))
            return false;

        const encrypted_key = (await Wallet.encrypt(public_key, await this.__loadRoleKey(author, role))).to_string;

        this.meta.roles[role][public_key] = encrypted_key;

        this.logAction(author, 'authorize_key_for_role', { role, public_key }, { encrypted_key });

        return true;
    }

    async metadataFileExists() {
        return await this.fileExists(Vault.METADATA_FILE_NAME);
    }

    async loadMetadata() {
        try {
            const data = await this.getFile(Vault.METADATA_FILE_NAME);
            this.meta = await JSON.parse(data);
            this.containers = {};
            for (const name in this.meta.containers) {
                this.containers[name] = Container.typeFactory(
                    this.meta.containers[name].container_type,
                    this,
                    name,
                    this.meta.containers[name],
                );
            }
            // TODO: Check Vault Version number and apply migrations if necessary
            return this.meta;
        } catch (_err) {
            if (_err instanceof DriverError) {
                throw new Error("Unable to load vault from Storage driver '" + _err.errorState + "'");
            }

            if (_err instanceof SyntaxError) {
                throw new Error('Unable to parse vault metadata');
            }

            throw _err;
        }
    }

    async writeMetadata(author: Wallet) {
        await this.updateContainerMetadata(author);
        this.meta = utils.signObject(author, this.meta);
        await this.putFile(Vault.METADATA_FILE_NAME, utils.stringify(this.meta));
        return this.meta.signed;
    }

    async deleteMetadata() {
        return await this.removeFile(Vault.METADATA_FILE_NAME);
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
        return await ResourceLock(this.id, this.driver, "fileExists", [filePath]);
    }

    async getFile(filePath: string) {
        return await ResourceLock(this.id, this.driver, "getFile", [filePath]);
    }

    async putFile(filePath: string, fileData: any) {
        return await ResourceLock(this.id, this.driver, "putFile", [filePath, fileData]);
    }

    async removeFile(filePath: string) {
        return await ResourceLock(this.id, this.driver, "removeFile", [filePath]);
    }

    getOrCreateContainer(author: Wallet, name: string, container_type?: string) {
        if (this.containers[name] instanceof Container) return this.containers[name];
        this.logAction(author, 'create_container', { name, container_type });
        const container = Container.typeFactory(container_type || 'embedded_file', this, name);
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

    constructor(vault: Vault, name: string, meta?: any) {
        this.vault = vault;
        this.name = name;
        this.meta = meta || {
            roles: ['owners'],
        };
    }

    static typeFactory(container_type: string, vault: Vault, name: string, meta?: any) {
        if (container_type == 'embedded_file') return new EmbeddedFileContainer(vault, name, meta);
        if (container_type == 'embedded_list') return new EmbeddedListContainer(vault, name, meta);

        if (container_type == 'external_file') return new ExternalFileContainer(vault, name, meta);
        if (container_type == 'external_list') return new ExternalListContainer(vault, name, meta);
        if (container_type == 'external_list_daily') return new ExternalListDailyContainer(vault, name, meta);

        throw new Error("Unknown Container type: '" + container_type + "'");
    }

    authorize_role(author: Wallet, role: string) {
        this.meta.roles.append(role);
        this.vault.logAction(author, 'container.authorize_role', {
            role,
            container_type: this.container_type,
            name: this.name,
        });
    }

    abstract async encryptContents();

    abstract async decryptContents(user: Wallet);

    abstract async buildMetadata(author: Wallet);

    abstract async verify();

    logAction(author: Wallet, action: string, params?: any, output?: any) {
        return this.vault.logAction(
            author,
            'container.' + this.container_type + '.' + action,
            { name: this.name, ...params },
            output,
        );
    }
}

export abstract class EmbeddedContainer extends Container {
    public container_type: string;
    public raw_contents: any = null;
    public encrypted_contents: any = null;

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = meta ? meta.encrypted_contents : {};
    }

    abstract getRawContents();

    async encryptContents() {
        if(this.modified_raw_contents || Object.keys(this.encrypted_contents).length === 0 ) {
            const unencrypted = this.getRawContents();
            this.encrypted_contents = {};

            for (const idx in this.meta.roles) {
                const role = this.meta.roles[idx];
                try {
                    const _encrypted_data = await this.vault.encryptForRole(role, unencrypted);
                    this.encrypted_contents[role] = _encrypted_data.to_string;
                } catch (_err) {
                    throw new Error('Unable to encrypt vault data (' + _err.message + ')');
                }
            }
        }

        return this.encrypted_contents;
    }

    async decryptContents(user: Wallet) {
        const role = this.vault.authorized_role(user.public_key);

        if (role && this.encrypted_contents[role]) {
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
            throw new Error('Unauthorized access to vault contents');
        }
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

export class EmbeddedFileContainer extends EmbeddedContainer {
    public container_type: string = 'embedded_file';

    constructor(vault: Vault, name: string, meta?) {
        super(vault, name, meta);
        this.raw_contents = [];
    }

    setContents(author: Wallet, blob: any) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        this.raw_contents = blob;
        this.modified_raw_contents = true;
        const hash = utils.objectHash(blob);
        this.logAction(author, 'setcontents', null, { hash });
    }

    getRawContents() {
        return this.raw_contents;
    }
}

export class EmbeddedListContainer extends EmbeddedContainer {
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
        this.logAction(author, 'append', null, { hash });
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

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = null;
        this.raw_contents = [];
    }

    getRawContents() {
        return this.raw_contents;
    }

    protected getExternalFilename() {
        return this.name + '.json';
    }

    async loadEncryptedFileContents() {
        // Only load encrypted contents from the file if we don't have it already. `vault.getFile` can be expensive
        if (!this.encrypted_contents) {
            try {
                let file_contents = await this.vault.getFile(this.getExternalFilename());
                this.encrypted_contents = JSON.parse(file_contents);
            } catch (_err) {
                this.encrypted_contents = {};
            }
        }
    }

    protected async writeEncryptedFileContents(author: Wallet) {
        let file_contents = JSON.stringify(this.encrypted_contents);
        await this.vault.putFile(this.getExternalFilename(), file_contents);
        return utils.objectSignature(author, file_contents);
    }

    async encryptContents() {
        const unencrypted = this.getRawContents();
        this.encrypted_contents = {};

        for (const idx in this.meta.roles) {
            const role = this.meta.roles[idx];

            try {
                const _encrypted_data = await this.vault.encryptForRole(role, unencrypted);
                this.encrypted_contents[role] = _encrypted_data.to_string;
            } catch (_err) {
                throw new Error('Unable to encrypt vault data (' + _err.message + ')');
            }
        }
    }

    async decryptContents(user: Wallet) {
        const role = this.vault.authorized_role(user.public_key);

        await this.loadEncryptedFileContents();

        if (role && this.encrypted_contents[role]) {
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
            throw new Error('Unauthorized access to vault contents');
        }
    }

    async verify() {
        const external_file_name = this.getExternalFilename();
        const file_contents = await this.vault.getFile(external_file_name);

        const container_meta = this.vault.getContainerMetadata(this.name);
        const container_signature = container_meta[external_file_name];

        const rebuilt_object = { ...file_contents, signed: container_signature };

        return utils.verifyHash(rebuilt_object) && utils.verifySignature(container_signature);
    }

    async buildMetadata(author: Wallet) {
        // Only build metadata if we've modified the contents of if this is a new vault.
        // check fileExists last to prevent it from being called if we DO modify data
        if(this.modified_raw_contents || !(await this.vault.fileExists(this.getExternalFilename())) ) {
            const containerKey = this.getExternalFilename();
            await this.encryptContents();

            let metadata = this.meta;
            metadata.container_type = this.container_type;
            metadata[containerKey] = await this.writeEncryptedFileContents(author);

            return metadata;
        } else {
            return this.meta;
        }
    }
}

export class ExternalFileContainer extends ExternalContainer {
    public container_type: string = 'external_file';

    setContents(author: Wallet, blob: any) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        this.raw_contents = blob;
        this.modified_raw_contents = true;
        const hash = utils.objectHash(blob);
        this.logAction(author, 'setcontents', null, { hash });
    }
}

export class ExternalListContainer extends ExternalContainer {
    public container_type: string = 'external_list';

    async append(author: Wallet, blob) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        const hash = utils.objectHash(blob);
        if (!this.raw_contents.length && (this.encrypted_contents && Object.keys(this.encrypted_contents).length)) {
            await this.decryptContents(author);
        }

        this.raw_contents.push(blob);
        this.modified_raw_contents = true;
        this.logAction(author, 'append', null, { hash });
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

export class ExternalListDailyContainer extends ExternalContainer {
    public container_type: string = 'external_list_daily';
    private modified_days: string[] = [];
    private desired_day: string = ExternalListDailyContainer.getCurrentDayProperty();

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.encrypted_contents = null;
        this.raw_contents = {};
    }

    static getCurrentDayProperty(): string {
        let today = new Date();
        return (
            today.getUTCFullYear() + ('0' + (today.getUTCMonth() + 1)).slice(-2) + ('0' + today.getUTCDate()).slice(-2)
        );
    }

    protected getExternalFilename() {
        return path.join(this.name, this.desired_day + '.json');
    }

    protected async writeEncryptedFileContents(author: Wallet) {
        let file_contents = JSON.stringify(this.encrypted_contents[this.desired_day]);
        await this.vault.putFile(this.getExternalFilename(), file_contents);
        return utils.objectSignature(author, file_contents);
    }

    async append(author: Wallet, blob) {
        if (blob === null || blob === undefined || blob === '') {
            throw new Error('New Content cannot be empty');
        }

        let todaysProperty = ExternalListDailyContainer.getCurrentDayProperty();
        this.desired_day = todaysProperty;

        const hash = utils.objectHash(blob);

        if (
            !this.raw_contents.hasOwnProperty(todaysProperty) &&
            this.meta[this.getExternalFilename()]
        ) {
            await this.decryptContents(author, todaysProperty);
        }

        if (!this.raw_contents.hasOwnProperty(todaysProperty)) {
            this.raw_contents[todaysProperty] = [];
        }

        this.raw_contents[todaysProperty].push(blob);
        this.modified_days.push(todaysProperty);
        this.logAction(author, 'append', null, { hash });
    }

    getRawContents() {
        return utils.stringify(this.raw_contents[this.desired_day]);
    }

    async encryptContents() {
        let all_contents = {};

        for (let property of this.modified_days) {
            if (this.raw_contents.hasOwnProperty(property)) {
                this.desired_day = property;
                await super.encryptContents();
                all_contents[property] = this.encrypted_contents;
            }
        }

        this.encrypted_contents = all_contents;
    }

    async decryptContents(user: Wallet, day?: string) {
        if (day) {
            return this.decryptDayContents(user, day);
        } else {
            return this.decryptAllContents(user);
        }
    }

    async decryptDayContents(user: Wallet, day: string) {
        this.desired_day = day;

        const decrypted = await super.decryptContents(user);

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
                let desired_day = property.split(path.sep)[1];
                desired_day = desired_day.split('.')[0];
                this.encrypted_contents = null;
                let day_data = await this.decryptDayContents(user, desired_day);
                all_contents = all_contents.concat(day_data);
            }
        }

        return all_contents;
    }

    async buildMetadata(author: Wallet) {
        await this.encryptContents();

        let external_file_signatures = {};

        for (let property of this.modified_days) {
            this.desired_day = property;
            let container_key = this.getExternalFilename();
            external_file_signatures[container_key] = await this.writeEncryptedFileContents(author);
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
                let desired_day = property.split(path.sep)[1];
                this.desired_day = desired_day.split('.')[0];
                if (!(await super.verify())) {
                    all_verified = false;
                }
            }
        }

        return all_verified;
    }
}
