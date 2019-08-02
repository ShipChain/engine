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

import { Primitive } from '../Primitive';
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from "../../../utils";

import { Wallet } from "../../../entity/Wallet";
import { RemoteVault } from "../../../vaults/RemoteVault";

export class Shipment extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Shipment.name, meta);
        this.injectContainerMetadata();
    }

    async setShipmentData(wallet: Wallet, shipment: any): Promise<void> {
        await this.setContents(wallet, JSON.stringify(shipment));
    }

    async getShipmentData(wallet: Wallet): Promise<string> {
        let shipment = await this.decryptContents(wallet);
        shipment = JSON.parse(shipment);
        return await RemoteVault.processContentForLinks(shipment);
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
}

applyMixins(Shipment, [Primitive]);
