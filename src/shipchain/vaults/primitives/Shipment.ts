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

import { Primitive, PrimitiveProperties } from '../Primitive';
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ShipmentProperties extends PrimitiveProperties {
    fields: {};
    documents: {
        bill_of_lading?: string;
        waybill?: string;
        commercial_invoice?: string;
    };
    tracking: string;
    items: {};

    constructor(initializingJson: any = {}) {
        super(initializingJson, ShipmentProperties.initializeProperties);
    }
    static initializeProperties(primitive: any) {
        primitive.fields = {};
        primitive.documents = {};
        primitive.tracking = null;
        primitive.items = {};
    }
}

export class Shipment extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Shipment.name, meta);
        this.injectContainerMetadata();
    }

    // FULL SHIPMENT ACCESS
    // ====================
    async getShipment(wallet: Wallet): Promise<ShipmentProperties> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        return await RemoteVault.processContentForLinks(shipment);
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<string> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        return await RemoteVault.processContentForLinks(shipment.fields);
    }

    async setFields(wallet: Wallet, shipmentFields: any): Promise<void> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        shipment.fields = shipmentFields;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // DOCUMENT ACCESS
    // ===============
    async listDocuments(wallet: Wallet): Promise<string[]> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        return Object.keys(shipment.documents);
    }

    async getDocument(wallet: Wallet, documentName: string): Promise<string> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        if (shipment && shipment.documents && shipment.documents.hasOwnProperty(documentName)) {
            const singleDocument: ShipmentProperties = new ShipmentProperties();
            singleDocument.documents[documentName] = shipment.documents[documentName];
            return await RemoteVault.processContentForLinks(singleDocument.documents);
        } else {
            throw new Error(`Document '${documentName}' not found in Shipment`);
        }
    }

    async addDocument(wallet: Wallet, documentName: string, documentLink: string): Promise<void> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        shipment.documents[documentName] = documentLink;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // TRACKING ACCESS
    // ===============
    async getTracking(wallet: Wallet): Promise<any> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        if (shipment && shipment.tracking) {
            return await RemoteVault.processContentForLinks(shipment.tracking);
        } else {
            throw new Error(`Tracking not found in Shipment`);
        }
    }

    async setTracking(wallet: Wallet, trackingLink: string): Promise<any> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        shipment.tracking = trackingLink;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // ITEMS ACCESS
    // ============
    async listItems(wallet: Wallet): Promise<string[]> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        return Object.keys(shipment.items);
    }

    async getItem(wallet: Wallet, itemId: number): Promise<any> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        if (shipment && shipment.items && shipment.items.hasOwnProperty(itemId)) {
            const singleItem: ShipmentProperties = new ShipmentProperties();
            singleItem.items[itemId] = shipment.items[itemId];
            return await RemoteVault.processContentForLinks(singleItem.items);
        } else {
            throw new Error(`Item '${itemId}' not found in Shipment`);
        }
    }

    async addItem(wallet: Wallet, itemId: string, itemLink: string, quantity: number = 1): Promise<void> {
        let shipment: ShipmentProperties = await this._getData(ShipmentProperties, wallet);
        shipment.items[itemId] = {
            quantity: quantity,
            item: itemLink,
        };
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
    async _getData(klass: typeof PrimitiveProperties, wallet: Wallet): Promise<any> {
        return;
    }
}

applyMixins(Shipment, [Primitive]);
