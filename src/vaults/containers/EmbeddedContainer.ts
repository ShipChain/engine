/*
 * Copyright 2019 ShipChain, Inc.
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

import { Vault } from '../Vault';
import { Wallet } from '../../entity/Wallet';
import { Container, ListContentContainer, SingleContentContainer } from '../Container';
import { Logger } from '../../Logger';

import * as utils from '../../utils';

const logger = Logger.get(module.filename);

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
