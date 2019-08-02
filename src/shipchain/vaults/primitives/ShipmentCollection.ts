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

import { Primitive, PrimitiveCollection } from "../Primitive";
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';

import { LinkContainer, LinkEntry } from "../../../vaults/containers/LinkContainer";
import { applyMixins } from "../../../utils";

import { Wallet } from "../../../entity/Wallet";
import { RemoteVault } from "../../../vaults/RemoteVault";

export class ShipmentCollection extends LinkContainer implements Primitive, PrimitiveCollection {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Shipment.name, meta);
        this.injectContainerMetadata();
    }

    async addShipment(wallet: Wallet, linkEntry: LinkEntry): Promise<string> {
        const linkId: string = Object.keys(this.linkEntries).length.toString();
        await this.addLink(wallet, linkEntry, linkId);
        return linkId;
    }

    async getShipment(linkId: string): Promise<string> {
        let shipment = await this.getLinkedContent(linkId);
        shipment = JSON.parse(shipment);
        return await RemoteVault.processContentForLinks(shipment);
    }

    // Primitive Mixin placeholders
    // ----------------------------
    linkEntries: any;
    injectContainerMetadata(): void {}
    count(): number {return 0;}
    list(): String[] {return [];}
}

applyMixins(ShipmentCollection, [Primitive, PrimitiveCollection]);
