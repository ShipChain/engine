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

import { Primitive, PrimitiveList, PrimitiveProperties } from '../Primitive';
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';
import { ProductProperties } from './Product';

import { LinkContainer, LinkEntry } from '../../../vaults/containers/LinkContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';

export class ProductList extends LinkContainer implements Primitive, PrimitiveList {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.ProductList.name, meta);
        this.injectContainerMetadata();
        this.propertiesKlass = ProductProperties;
    }

    // Primitive Mixin placeholders
    // ----------------------------
    /* istanbul ignore next */
    injectContainerMetadata(): void {}
    /* istanbul ignore next */
    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<T> {
        return undefined;
    }
    linkEntries: any;
    propertiesKlass: { new (...args: any[]): PrimitiveProperties };
    /* istanbul ignore next */
    async addEntity(wallet: Wallet, entityId: string, entityLink: LinkEntry): Promise<void> {
        return undefined;
    }
    /* istanbul ignore next */
    async getEntity<T extends PrimitiveProperties>(linkId: string): Promise<T> {
        return undefined;
    }
    /* istanbul ignore next */
    count(): number {
        return 0;
    }
    /* istanbul ignore next */
    list(): String[] {
        return [];
    }
}

applyMixins(ProductList, [PrimitiveList, Primitive]);
