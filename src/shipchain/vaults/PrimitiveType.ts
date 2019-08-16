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

import { Primitive } from './Primitive';
import { ShipChainVault } from './ShipChainVault';

import { Procurement } from './primitives/Procurement';
import { Shipment } from './primitives/Shipment';
import { Document } from './primitives/Document';
import { Product } from './primitives/Product';
import { Item } from './primitives/Item';
import { ProcurementCollection } from './primitives/ProcurementCollection';
import { ShipmentCollection } from './primitives/ShipmentCollection';
import { DocumentCollection } from './primitives/DocumentCollection';
import { ProductCollection } from './primitives/ProductCollection';
import { ItemCollection } from './primitives/ItemCollection';

export class PrimitiveType {
    static readonly Procurement = new PrimitiveType('Procurement', Procurement);
    static readonly Shipment = new PrimitiveType('Shipment', Shipment);
    static readonly Document = new PrimitiveType('Document', Document);
    static readonly Product = new PrimitiveType('Product', Product);
    static readonly Item = new PrimitiveType('Item', Item);
    static readonly ProcurementCollection = new PrimitiveType(
        'ProcurementCollection',
        ProcurementCollection,
        'Procurement',
    );
    static readonly ShipmentCollection = new PrimitiveType('ShipmentCollection', ShipmentCollection, 'Shipment');
    static readonly DocumentCollection = new PrimitiveType('DocumentCollection', DocumentCollection, 'Document');
    static readonly ProductCollection = new PrimitiveType('ProductCollection', ProductCollection, 'Product');
    static readonly ItemCollection = new PrimitiveType('ItemCollection', ItemCollection, 'Item');

    // private to disallow creating other instances of this type
    private constructor(
        public readonly name: string,
        public readonly primitiveClass: any,
        public readonly collectionOf?: string,
    ) {}

    create(vault: ShipChainVault, meta?: any): Primitive {
        return <Primitive>new this.primitiveClass(vault, meta);
    }

    static isValid(primitiveType: string): boolean {
        return primitiveType && PrimitiveType[primitiveType] && PrimitiveType[primitiveType].name === primitiveType;
    }

    toString() {
        return this.name;
    }
}
