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

import { ListContentContainer, MultiContentContainer } from '../Container';
import { ExternalContainer } from './ExternalContainer';

import * as path from 'path';
import * as utils from '../../utils';

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

    async decryptContents(user: Wallet, fileName?: string) {
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
