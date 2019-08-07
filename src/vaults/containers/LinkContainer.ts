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

import { Container } from '../Container';
import { Vault } from '../Vault';
import { RemoteVault } from '../RemoteVault';
import { Wallet } from '../../entity/Wallet';

import * as utils from '../../utils';

export class LinkEntry {
    remoteUrl?: string;

    remoteVault: string;
    remoteWallet: string;
    remoteStorage: string;
    container: string;
    revision: number;
    hash: string;

    subFile?: string;
}

export class LinkContainer extends Container {
    public container_type: string = 'link';
    public linkEntries: { string?: LinkEntry } = null;

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.linkEntries = meta && meta.linkEntries ? meta.linkEntries : {};
    }

    async getLinkedContent(linkId: string) {
        const linkEntry: LinkEntry = this.linkEntries[linkId];

        if (!linkEntry) {
            throw new Error(`LinkID [${linkId}] not found!`);
        }

        const otherVault = new RemoteVault(linkEntry);
        return await otherVault.getLinkedData();
    }

    async getLinkEntry(linkId: string) {
        const linkEntry: LinkEntry = this.linkEntries[linkId];

        if (!linkEntry) {
            throw new Error(`LinkID [${linkId}] not found!`);
        }

        return linkEntry;
    }

    async addLink(author: Wallet, linkId: string, linkEntry: LinkEntry) {
        this.linkEntries[linkId] = linkEntry;
        const hash = utils.objectHash(linkEntry);
        await this.updateLedger(author, 'addlink', linkEntry, { hash });
    }

    async encryptContents() {
        throw new Error(`Encryption not supported for Remote Containers`);
    }

    async decryptContents(user: Wallet) {
        throw new Error(`Encryption not supported for Remote Containers`);
    }

    async buildMetadata(author: Wallet) {
        let metadata = this.meta;
        metadata.container_type = this.container_type;
        metadata.linkEntries = this.linkEntries;
        return metadata;
    }

    async verify() {
        // Link containers are verified via the main metadata signature
        return true;
    }
}
