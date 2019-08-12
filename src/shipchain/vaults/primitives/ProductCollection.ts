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

import { Primitive, PrimitiveCollection, PrimitiveProperties } from '../Primitive';
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';
import { ProductProperties } from './Product';

import { LinkContainer, LinkEntry } from '../../../vaults/containers/LinkContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ProductCollection extends LinkContainer implements Primitive, PrimitiveCollection {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.ProductCollection.name, meta);
        this.injectContainerMetadata();
    }

    async addProduct(wallet: Wallet, productId: string, productLink: LinkEntry): Promise<void> {
        await this.addLink(wallet, productId, productLink);
    }

    async getProduct(linkId: string): Promise<ProductProperties> {
        let content: string = await this.getLinkedContent(linkId);
        let product: ProductProperties = new ProductProperties(JSON.parse(content));
        product = await RemoteVault.processContentForLinks(product);
        await product.process();
        return product;
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<any> {
        return undefined;
    }
    linkEntries: any;
    count(): number {
        return 0;
    }
    list(): String[] {
        return [];
    }
}

applyMixins(ProductCollection, [Primitive, PrimitiveCollection]);
