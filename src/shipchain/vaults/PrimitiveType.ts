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

import { Shipment } from './primitives/Shipment';
import { ShipmentCollection } from './primitives/ShipmentCollection';


export class PrimitiveType {
    static readonly Shipment = new PrimitiveType('Shipment', Shipment);
    static readonly ShipmentCollection = new PrimitiveType('ShipmentCollection', ShipmentCollection);

    // private to disallow creating other instances of this type
    private constructor(public readonly name: string, public readonly primitiveClass: any) {}

    create(vault: ShipChainVault, meta?: any): Primitive {
        return <Primitive>new this.primitiveClass(vault, meta);
    }

    static isValid(primitiveType: string): boolean {
        return primitiveType &&
            PrimitiveType[primitiveType] &&
            PrimitiveType[primitiveType].name === primitiveType;
    }

    toString() {
        return this.name;
    }
}