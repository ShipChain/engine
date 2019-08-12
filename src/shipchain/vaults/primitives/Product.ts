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

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ProductProperties extends PrimitiveProperties {
    fields: {
        sku?: string;
        name?: string;
        description?: string;
        price?: string;
        color?: string;
        weight?: string;
        dimensions?: string;
    };
    documents: {};

    constructor(initializingJson: any = {}) {
        super(initializingJson, ProductProperties.initializeProperties);
    }
    static initializeProperties(primitive: ProductProperties) {
        primitive.fields = {};
        primitive.documents = {};
    }

    async process() {
        for (let document in this.documents) {
            if (this.documents.hasOwnProperty(document)) {
                this.documents[document] = new DocumentProperties(JSON.parse(this.documents[document]));
            }
        }
    }
}

export class Product extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Product.name, meta);
        this.injectContainerMetadata();
    }

    // FULL PRODUCT ACCESS
    // ===================
    async getProduct(wallet: Wallet): Promise<ProductProperties> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        product = await RemoteVault.processContentForLinks(product);
        await product.process();
        return product;
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<string> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        return await RemoteVault.processContentForLinks(product.fields);
    }

    async setFields(wallet: Wallet, productFields: any): Promise<void> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        product.fields = productFields;
        await this.setContents(wallet, JSON.stringify(product));
    }

    // DOCUMENT ACCESS
    // ===============
    async listDocuments(wallet: Wallet): Promise<string[]> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        return Object.keys(product.documents);
    }

    async getDocument(wallet: Wallet, documentName: string): Promise<DocumentProperties> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        if (product && product.documents && product.documents.hasOwnProperty(documentName)) {
            let singleDocument: ProductProperties = new ProductProperties();
            singleDocument.documents[documentName] = product.documents[documentName];
            singleDocument = await RemoteVault.processContentForLinks(singleDocument);
            await singleDocument.process();
            return singleDocument.documents[documentName];
        } else {
            throw new Error(`Document '${documentName}' not found in Product`);
        }
    }

    async addDocument(wallet: Wallet, documentId: string, documentLink: string): Promise<void> {
        let product: ProductProperties = await this.getPrimitiveProperties(ProductProperties, wallet);
        product.documents[documentId] = documentLink;
        await this.setContents(wallet, JSON.stringify(product));
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

applyMixins(Product, [Primitive]);
