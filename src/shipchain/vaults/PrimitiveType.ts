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
import { Tracking } from './primitives/Tracking';
import { Telemetry } from './primitives/Telemetry';
import { Document } from './primitives/Document';
import { Product } from './primitives/Product';
import { Item } from './primitives/Item';
import { ProcurementList } from './primitives/ProcurementList';
import { ShipmentList } from './primitives/ShipmentList';
import { DocumentList } from './primitives/DocumentList';
import { ProductList } from './primitives/ProductList';
import { ItemList } from './primitives/ItemList';

export class PrimitiveType {
    static readonly Procurement = new PrimitiveType('Procurement', Procurement);
    static readonly Shipment = new PrimitiveType('Shipment', Shipment);
    static readonly Tracking = new PrimitiveType('Tracking', Tracking);
    static readonly Telemetry = new PrimitiveType('Telemetry', Telemetry);
    static readonly Document = new PrimitiveType('Document', Document);
    static readonly Product = new PrimitiveType('Product', Product);
    static readonly Item = new PrimitiveType('Item', Item);
    static readonly ProcurementList = new PrimitiveType('ProcurementList', ProcurementList, 'Procurement');
    static readonly ShipmentList = new PrimitiveType('ShipmentList', ShipmentList, 'Shipment');
    static readonly DocumentList = new PrimitiveType('DocumentList', DocumentList, 'Document');
    static readonly ProductList = new PrimitiveType('ProductList', ProductList, 'Product');
    static readonly ItemList = new PrimitiveType('ItemList', ItemList, 'Item');

    // private to disallow creating other instances of this type
    private constructor(
        public readonly name: string,
        public readonly primitiveClass: any,
        public readonly listOf?: string,
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
