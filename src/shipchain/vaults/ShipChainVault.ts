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

import { Vault } from '../../vaults/Vault';
import { Wallet } from '../../entity/Wallet';
import { Container } from '../../vaults/Container';
import { Primitive } from './Primitive';
import { PrimitiveType } from './PrimitiveType';

export class ShipChainVault extends Vault {
    constructor(storage_driver, id?) {
        super(storage_driver, id);
    }

    async initializeMetadata(author: Wallet, additionalMeta?: any) {
        let meta = {
            isShipChainVault: true,
        };
        meta = Object.assign(meta, additionalMeta);

        super.initializeMetadata(author, meta);
    }

    async loadMetadata() {
        await super.loadMetadata();
        if (!this.meta.isShipChainVault) {
            throw new Error(`Vault ${this.id} is not a ShipChainVault`);
        }
        return this.meta;
    }

    async getContainerContent(content: any, name: string): Promise<Container | Primitive> {
        if (PrimitiveType.isValid(name)) {
            return PrimitiveType[name].create(this, await this.decompressContainerMeta(content));
        } else {
            return super.getContainerContent(content, name);
        }
    }

    getPrimitive(primitiveType: string): any {
        if (!PrimitiveType.isValid(primitiveType)) {
            throw new Error(`Primitive type is not valid [${primitiveType}]`);
        }

        if (!this.hasPrimitive(primitiveType)) {
            throw new Error(`Primitive ${primitiveType} does not exist in Vault ${this.id}`);
        }

        return this.containers[primitiveType];
    }

    hasPrimitive(primitiveType: string): Boolean {
        return (
            PrimitiveType.isValid(primitiveType) &&
            this.containers &&
            this.containers[PrimitiveType[primitiveType].name] &&
            this.containers[PrimitiveType[primitiveType].name] instanceof Container &&
            this.containers[PrimitiveType[primitiveType].name].meta.isPrimitive
        );
    }

    injectPrimitive(primitiveType: string) {
        if (!PrimitiveType.isValid(primitiveType)) {
            throw new Error(`Primitive type is not valid [${primitiveType}]`);
        }

        if (this.hasPrimitive(primitiveType)) {
            throw new Error(`Primitive ${primitiveType} already exists in Vault ${this.id}`);
        }

        this.containers[primitiveType] = PrimitiveType[primitiveType].create(this);
    }
}
