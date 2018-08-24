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
        return this.meta;
    }

    async addTrackingData(author, payload) {
        await this.containers.tracking.append(author, payload);
    }

    async getTrackingData(author) {
        await this.loadMetadata();
        return await this.containers.tracking.decryptContents(author);
    }

    async addShipmentData(author, shipment) {
        await this.containers.shipment.setContents(author, JSON.stringify(shipment));
    }

    async getShipmentData(author) {
        await this.loadMetadata();
        const contents = await this.containers.shipment.decryptContents(author);
        return JSON.parse(contents);
    }
}
