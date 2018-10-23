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

import { Vault } from '../vaults/Vault';
import { Wallet } from '../entity/Wallet';

export class LoadVault extends Vault {
    constructor(storage_driver, id?) {
        super(storage_driver, id);
    }

    async initializeMetadata(author: Wallet) {
        await super.initializeMetadata(author);
        this.getOrCreateContainer(author, 'tracking', 'embedded_list');
        this.getOrCreateContainer(author, 'shipment', 'embedded_file');
        this.getOrCreateContainer(author, 'documents', 'external_file_multi');
        return this.meta;
    }

    async addTrackingData(author: Wallet, payload) {
        await this.containers.tracking.append(author, payload);
    }

    async getTrackingData(author: Wallet) {
        await this.loadMetadata();
        return await this.containers.tracking.decryptContents(author);
    }

    async addShipmentData(author: Wallet, shipment) {
        await this.containers.shipment.setContents(author, JSON.stringify(shipment));
    }

    async getShipmentData(author: Wallet) {
        await this.loadMetadata();
        const contents = await this.containers.shipment.decryptContents(author);
        return JSON.parse(contents);
    }

    async addDocument(author: Wallet, name: string, document: any) {
        await this.containers.documents.setSingleContent(author, name, document);
    }

    async getDocument(author: Wallet, name: string) {
        await this.loadMetadata();
        return await this.containers.documents.decryptContents(author, name);
    }

    async listDocuments() {
        return await this.containers.documents.listFiles();
    }
}
