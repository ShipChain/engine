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
import * as utils from '../../utils';
import { Container, ListContentContainer, SingleContentContainer } from '../Container';
import { Logger } from '../../Logger';

import * as path from 'path';

const logger = Logger.get(module.filename);

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
                    `Vault ${this.vault.id} Decrypting Ext Container ${this.name} has no content for role ${role} [${subFile}]`,
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
