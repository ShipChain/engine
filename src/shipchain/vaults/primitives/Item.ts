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
import { ProductProperties } from './Product';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ItemProperties extends PrimitiveProperties {
    fields: {
        serial_number?: string;
        batch_id?: string;
        lot_number?: string;
        price?: string;
        expiration_date?: string;
    };
    product: string | ProductProperties;

    constructor(initializingJson: any = {}) {
        super(initializingJson, ItemProperties.initializeProperties);
    }
    static initializeProperties(primitive: ItemProperties) {
        primitive.fields = {};
        primitive.product = null;
    }

    async process() {
        if (this.product) {
            if (typeof this.product === 'string') {
                this.product = new ProductProperties(JSON.parse(this.product));
                this.product = (await RemoteVault.processContentForLinks(this.product)) as ProductProperties;
                await this.product.process();
            }
        }
    }
}

export class Item extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Item.name, meta);
        this.injectContainerMetadata();
    }

    // FULL ITEM ACCESS
    // ================
    async getItem(wallet: Wallet): Promise<ItemProperties> {
        let item: ItemProperties = await this.getPrimitiveProperties(ItemProperties, wallet);
        item = await RemoteVault.processContentForLinks(item);
        await item.process();
        return item;
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<string> {
        let item: ItemProperties = await this.getPrimitiveProperties(ItemProperties, wallet);
        return await RemoteVault.processContentForLinks(item.fields);
    }

    async setFields(wallet: Wallet, itemFields: any): Promise<void> {
        let item: ItemProperties = await this.getPrimitiveProperties(ItemProperties, wallet);
        item.fields = itemFields;
        await this.setContents(wallet, JSON.stringify(item));
    }

    // PRODUCT ACCESS
    // ==============
    async getProduct(wallet: Wallet): Promise<ProductProperties> {
        let item: ItemProperties = await this.getPrimitiveProperties(ItemProperties, wallet);
        if (item && item.product) {
            item = await RemoteVault.processContentForLinks(item);
            await item.process();
            return item.product as ProductProperties;
        } else {
            throw new Error(`Product not found in Item`);
        }
    }

    async setProduct(wallet: Wallet, productLink: string): Promise<void> {
        Primitive.validateLinkedPrimitive(productLink, PrimitiveType.Product.name);
        let item: ItemProperties = await this.getPrimitiveProperties(ItemProperties, wallet);
        item.product = productLink;
        await this.setContents(wallet, JSON.stringify(item));
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

applyMixins(Item, [Primitive]);
