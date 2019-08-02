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
import { LinkEntry } from './containers/LinkContainer';
import { Container } from './Container';

import { URL } from 'url';
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

    // Parse string and return
    // ==================================================================
    static buildLinkEntry(embeddedLink: string): LinkEntry {
        const UUID_REGEX = /\/?([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}[^\/]*)\/?/gi;
        const VAULT_REV_HASH_REGEX = /^(?<vaultId>[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})(?:#(?<vaultRevision>\d+))?(?:@(?<vaultHash>0x[a-f0-9]{64}))?\/?$/i;

        const linkEntry: LinkEntry = new LinkEntry();

        // Remove the leading EMBEDDED_REFERENCE
        // -------------------------------------
        let ref: string = embeddedLink.slice(Container.EMBEDDED_REFERENCE.length);

        // Check for URL
        // -------------
        try {
            const parsedUrl = new URL(ref);
            linkEntry.remoteUrl = parsedUrl.origin;
            ref = ref.replace(linkEntry.remoteUrl, '');
        } catch (err) {
            // No URL, will be local Engine
        } finally {
            if (ref.startsWith('/')) {
                ref = ref.slice(1);
            }
        }

        // Find UUIDs and map to Vault/Storage/Wallet
        // ------------------------------------------
        let matches = ref.match(UUID_REGEX);
        ref = ref.replace(UUID_REGEX, '');

        if (matches.length === 3) {
            linkEntry.remoteVault = matches[0];
            linkEntry.remoteStorage = matches[1].replace(/\//g, '');
            linkEntry.remoteWallet = matches[2].replace(/\//g, '');
        } else {
            throw new Error(`Unable to parse ${Container.EMBEDDED_REFERENCE} link`);
        }

        // Find Revision and Hash from Vault
        // ---------------------------------
        matches = linkEntry.remoteVault.match(VAULT_REV_HASH_REGEX);
        if (matches && matches.groups) {
            linkEntry.remoteVault = matches.groups.vaultId;
            linkEntry.revision = Number(matches.groups.vaultRevision);
            linkEntry.hash = matches.groups.vaultHash;
        } else {
            throw new Error(`Unable to find vaultId in [${linkEntry.remoteVault}]`);
        }

        // Find Container and subFile
        // --------------------------
        [linkEntry.container, linkEntry.subFile] = ref.split('.');

        return linkEntry;
    }

    private static async _processStringForLinks(content: string): Promise<any> {
        let returnedContent: any = content;

        if (content.startsWith(Container.EMBEDDED_REFERENCE)) {
            const linkEntry = RemoteVault.buildLinkEntry(content);

            const remoteVault = new RemoteVault(linkEntry);
            returnedContent = remoteVault.getLinkedData();
        }

        return returnedContent;
    }

    private static async _processObjectForLinks(content: any): Promise<any> {
        for (let property in content) {
            if (content.hasOwnProperty(property)) {
                content[property] = await RemoteVault.processContentForLinks(content[property]);
            }
        }

        return content;
    }

    static async processContentForLinks(content: any): Promise<any> {
        if (typeof content === 'string') {
            return await RemoteVault._processStringForLinks(content);
        } else {
            return await RemoteVault._processObjectForLinks(content);
        }
    }
}
