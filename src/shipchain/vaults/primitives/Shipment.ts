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
import { DocumentProperties } from './Document';
import { ItemProperties } from './Item';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ShipmentItemProperties extends PrimitiveProperties {
    quantity: number;
    item: string | ItemProperties;

    constructor(initializingJson: any = {}) {
        super(initializingJson, ShipmentItemProperties.initializeProperties);
    }
    static initializeProperties(primitive: ShipmentItemProperties) {
        primitive.quantity = 1;
        primitive.item = null;
    }

    async process() {
        if (this.item && typeof this.item === 'string') {
            this.item = new ItemProperties(JSON.parse(this.item));
            this.item = (await RemoteVault.processContentForLinks(this.item)) as ItemProperties;
            await this.item.process();
        }
    }
}

export class ShipmentProperties extends PrimitiveProperties {
    fields: {};
    documents: {};
    tracking: string;
    items: {};

    constructor(initializingJson: any = {}) {
        super(initializingJson, ShipmentProperties.initializeProperties);
    }
    static initializeProperties(primitive: ShipmentProperties) {
        primitive.fields = {};
        primitive.documents = {};
        primitive.tracking = null;
        primitive.items = {};
    }

    async process() {
        await this._processDocuments();
        await this._processItems();
    }

    private async _processDocuments() {
        for (let document in this.documents) {
            if (this.documents.hasOwnProperty(document)) {
                this.documents[document] = new DocumentProperties(JSON.parse(this.documents[document]));
            }
        }
    }

    private async _processItems() {
        for (let item in this.items) {
            if (this.items.hasOwnProperty(item)) {
                this.items[item] = new ShipmentItemProperties(this.items[item]);
                await this.items[item].process();
            }
        }
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
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        shipment = await RemoteVault.processContentForLinks(shipment);
        await shipment.process();
        return shipment;
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<string> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        return await RemoteVault.processContentForLinks(shipment.fields);
    }

    async setFields(wallet: Wallet, shipmentFields: any): Promise<void> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        shipment.fields = shipmentFields;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // DOCUMENT ACCESS
    // ===============
    async listDocuments(wallet: Wallet): Promise<string[]> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        return Object.keys(shipment.documents);
    }

    async getDocument(wallet: Wallet, documentId: string): Promise<DocumentProperties> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        if (shipment && shipment.documents && shipment.documents.hasOwnProperty(documentId)) {
            let singleDocument: ShipmentProperties = new ShipmentProperties();
            singleDocument.documents[documentId] = shipment.documents[documentId];
            singleDocument = await RemoteVault.processContentForLinks(singleDocument);
            await singleDocument.process();
            return singleDocument.documents[documentId];
        } else {
            throw new Error(`Document '${documentId}' not found in Shipment`);
        }
    }

    async addDocument(wallet: Wallet, documentId: string, documentLink: string): Promise<void> {
        Primitive.validateLinkedPrimitive(documentLink, PrimitiveType.Document.name);
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        shipment.documents[documentId] = documentLink;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // TRACKING ACCESS
    // ===============
    async getTracking(wallet: Wallet): Promise<any> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        if (shipment && shipment.tracking) {
            return await RemoteVault.processContentForLinks(shipment.tracking);
        } else {
            throw new Error(`Tracking not found in Shipment`);
        }
    }

    async setTracking(wallet: Wallet, trackingLink: string): Promise<any> {
        Primitive.validateLinkedPrimitive(trackingLink, PrimitiveType.Tracking.name);
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        shipment.tracking = trackingLink;
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // ITEMS ACCESS
    // ============
    async listItems(wallet: Wallet): Promise<string[]> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        return Object.keys(shipment.items);
    }

    async getItem(wallet: Wallet, itemId: number): Promise<ShipmentItemProperties> {
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        if (shipment && shipment.items && shipment.items.hasOwnProperty(itemId)) {
            let singleItem: ShipmentProperties = new ShipmentProperties();
            singleItem.items[itemId] = shipment.items[itemId];
            singleItem = await RemoteVault.processContentForLinks(singleItem);
            await singleItem.process();
            return singleItem.items[itemId];
        } else {
            throw new Error(`Item '${itemId}' not found in Shipment`);
        }
    }

    async addItem(wallet: Wallet, itemId: string, itemLink: string, quantity: number = 1): Promise<void> {
        Primitive.validateLinkedPrimitive(itemLink, PrimitiveType.Item.name);
        let shipment: ShipmentProperties = await this.getPrimitiveProperties(ShipmentProperties, wallet);
        shipment.items[itemId] = new ShipmentItemProperties({
            quantity: quantity,
            item: itemLink,
        });
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<any> {
        return;
    }
}

applyMixins(Shipment, [Primitive]);
