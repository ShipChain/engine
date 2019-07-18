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

import { Vault } from './Vault';
import { Logger } from '../Logger';
import { StorageCredential } from '../entity/StorageCredential';
import { Wallet } from '../entity/Wallet';

import { URL } from 'url';
import { LinkEntry } from './containers/LinkContainer';

import { Client } from 'jayson/promise';

const logger = Logger.get(module.filename);

export class RemoteVault {
    private readonly linkEntry: LinkEntry;
    constructor(linkEntry: LinkEntry) {
        this.linkEntry = linkEntry;
    }

    async getLinkedData(): Promise<any> {
        let result = null;

        if (this.linkEntry.remoteUrl) {
            result = await this.sendOutgoingRequestToRemote();
        } else {
            result = await this.getLinkedDataInternally();
        }

        return result;
    }

    private async sendOutgoingRequestToRemote(): Promise<any> {
        const parsedUrl = new URL(this.linkEntry.remoteUrl);
        let client: Client;

        if (parsedUrl.protocol === 'https:') {
            client = Client.https({
                host: parsedUrl.hostname,
                port: +parsedUrl.port,
            });
        } else if (parsedUrl.protocol === 'http:') {
            client = Client.http({
                host: parsedUrl.hostname,
                port: +parsedUrl.port,
            });
        } else {
            throw new Error(`Invalid protocol in linkEntry [${parsedUrl.protocol}]`);
        }

        // Call RPC for remote Engine
        logger.debug(`Calling remote Engine ${this.linkEntry.remoteUrl}`);
        const resp = await client.request('vaults.linked.get_linked_data', { linkEntry: this.linkEntry });

        if (!resp.result) {
            throw new Error(
                `Remote Engine unable to load linked data [${
                    resp && resp.error && resp.error.message ? resp.error.message : resp
                }]`,
            );
        }
        return resp.result;
    }

    async getLinkedDataInternally(): Promise<any> {
        const storage = await StorageCredential.getOptionsById(this.linkEntry.remoteStorage);
        const wallet = await Wallet.getById(this.linkEntry.remoteWallet);
        const vault = new Vault(storage, this.linkEntry.remoteVault);
        await vault.loadMetadata();
        let vaultData = await vault.getHistoricalDataBySequence(
            wallet,
            this.linkEntry.container,
            this.linkEntry.revision,
            this.linkEntry.subFile,
        );

        vaultData = vaultData[this.linkEntry.container];

        if (this.linkEntry.subFile) {
            vaultData = vaultData[this.linkEntry.subFile];
        }

        return vaultData;
    }
}
