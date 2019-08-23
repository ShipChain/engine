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
import { ShipmentProperties } from './Shipment';
import { DocumentProperties } from './Document';
import { ProductProperties } from './Product';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ProcurementProductProperties extends PrimitiveProperties {
    quantity: number;
    product: string | ProductProperties;

    constructor(initializingJson: any = {}) {
        super(initializingJson, ProcurementProductProperties.initializeProperties);
    }
    static initializeProperties(primitive: ProcurementProductProperties) {
        primitive.quantity = 1;
        primitive.product = null;
    }

    async process() {
        if (this.product && typeof this.product === 'string') {
            this.product = new ProductProperties(JSON.parse(this.product));
            this.product = (await RemoteVault.processContentForLinks(this.product)) as ProductProperties;
            await this.product.process();
        }
    }
}

export class ProcurementProperties extends PrimitiveProperties {
    fields: {
        name?: string;
        description?: string;
    };
    shipments: {};
    documents: {};
    products: {};

    constructor(initializingJson: any = {}) {
        super(initializingJson, ProcurementProperties.initializeProperties);
    }
    static initializeProperties(primitive: ProcurementProperties) {
        primitive.fields = {};
        primitive.shipments = {};
        primitive.documents = {};
        primitive.products = {};
    }

    async process() {
        await this._processShipments();
        await this._processDocuments();
        await this._processProducts();
    }

    private async _processShipments() {
        for (let shipment in this.shipments) {
            if (this.shipments.hasOwnProperty(shipment)) {
                this.shipments[shipment] = new ShipmentProperties(JSON.parse(this.shipments[shipment]));
                this.shipments[shipment] = (await RemoteVault.processContentForLinks(
                    this.shipments[shipment],
                )) as ShipmentProperties;
                await this.shipments[shipment].process();
            }
        }
    }

    private async _processDocuments() {
        for (let document in this.documents) {
            if (this.documents.hasOwnProperty(document)) {
                this.documents[document] = new DocumentProperties(JSON.parse(this.documents[document]));
            }
        }
    }

    private async _processProducts() {
        for (let product in this.products) {
            if (this.products.hasOwnProperty(product)) {
                this.products[product] = new ProcurementProductProperties(this.products[product]);
                await this.products[product].process();
            }
        }
    }
}

export class Procurement extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Procurement.name, meta);
        this.injectContainerMetadata();
    }

    // FULL PRODUCT ACCESS
    // ===================
    async getProcurement(wallet: Wallet): Promise<ProcurementProperties> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        procurement = await RemoteVault.processContentForLinks(procurement);
        await procurement.process();
        return procurement;
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<any> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        return await RemoteVault.processContentForLinks(procurement.fields);
    }

    async setFields(wallet: Wallet, productFields: any): Promise<void> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        procurement.fields = productFields;
        await this.setContents(wallet, JSON.stringify(procurement));
    }

    // SHIPMENT ACCESS
    // ===============
    async listShipments(wallet: Wallet): Promise<string[]> {
        let product: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        return Object.keys(product.shipments);
    }

    async getShipment(wallet: Wallet, shipmentId: string): Promise<ShipmentProperties> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        if (procurement && procurement.shipments && procurement.shipments.hasOwnProperty(shipmentId)) {
            let singleShipment: ProcurementProperties = new ProcurementProperties();
            singleShipment.shipments[shipmentId] = procurement.shipments[shipmentId];
            singleShipment = await RemoteVault.processContentForLinks(singleShipment);
            await singleShipment.process();
            return singleShipment.shipments[shipmentId];
        } else {
            throw new Error(`Shipment '${shipmentId}' not found in Procurement`);
        }
    }

    async addShipment(wallet: Wallet, shipmentId: string, shipmentLink: string): Promise<void> {
        Primitive.validateLinkedPrimitive(shipmentLink, PrimitiveType.Shipment.name);
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        procurement.shipments[shipmentId] = shipmentLink;
        await this.setContents(wallet, JSON.stringify(procurement));
    }

    // DOCUMENT ACCESS
    // ===============
    async listDocuments(wallet: Wallet): Promise<string[]> {
        let product: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        return Object.keys(product.documents);
    }

    async getDocument(wallet: Wallet, documentId: string): Promise<DocumentProperties> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        if (procurement && procurement.documents && procurement.documents.hasOwnProperty(documentId)) {
            let singleDocument: ProcurementProperties = new ProcurementProperties();
            singleDocument.documents[documentId] = procurement.documents[documentId];
            singleDocument = await RemoteVault.processContentForLinks(singleDocument);
            await singleDocument.process();
            return singleDocument.documents[documentId];
        } else {
            throw new Error(`Document '${documentId}' not found in Procurement`);
        }
    }

    async addDocument(wallet: Wallet, documentName: string, documentLink: string): Promise<void> {
        Primitive.validateLinkedPrimitive(documentLink, PrimitiveType.Document.name);
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        procurement.documents[documentName] = documentLink;
        await this.setContents(wallet, JSON.stringify(procurement));
    }

    // PRODUCT ACCESS
    // ==============
    async listProducts(wallet: Wallet): Promise<string[]> {
        let product: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        return Object.keys(product.products);
    }

    async getProduct(wallet: Wallet, productId: string): Promise<ProcurementProductProperties> {
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        if (procurement && procurement.products && procurement.products.hasOwnProperty(productId)) {
            let singleProduct: ProcurementProperties = new ProcurementProperties();
            singleProduct.products[productId] = procurement.products[productId];
            singleProduct = await RemoteVault.processContentForLinks(singleProduct);
            await singleProduct.process();
            return singleProduct.products[productId];
        } else {
            throw new Error(`Product '${productId}' not found in Procurement`);
        }
    }

    async addProduct(wallet: Wallet, productId: string, productLink: string, quantity: number = 1): Promise<void> {
        Primitive.validateLinkedPrimitive(productLink, PrimitiveType.Product.name);
        let procurement: ProcurementProperties = await this.getPrimitiveProperties(ProcurementProperties, wallet);
        procurement.products[productId] = new ProcurementProductProperties({
            quantity: quantity,
            product: productLink,
        });
        await this.setContents(wallet, JSON.stringify(procurement));
    }

    // Primitive Mixin placeholders
    // ----------------------------
    /* istanbul ignore next */
    injectContainerMetadata(): void {}
    /* istanbul ignore next */
    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<any> {
        return;
    }
}

applyMixins(Procurement, [Primitive]);
