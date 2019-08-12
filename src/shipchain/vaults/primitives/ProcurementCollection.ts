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
import { ProcurementProperties } from './Procurement';

import { LinkContainer, LinkEntry } from '../../../vaults/containers/LinkContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class ProcurementCollection extends LinkContainer implements Primitive, PrimitiveCollection {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.ProcurementCollection.name, meta);
        this.injectContainerMetadata();
    }

    async addProcurement(wallet: Wallet, procurementId: string, procurementLink: LinkEntry): Promise<void> {
        await this.addLink(wallet, procurementId, procurementLink);
    }

    async getProcurement(linkId: string): Promise<ProcurementProperties> {
        let content: string = await this.getLinkedContent(linkId);
        let procurement: ProcurementProperties = new ProcurementProperties(JSON.parse(content));
        procurement = await RemoteVault.processContentForLinks(procurement);
        await procurement.process();
        return procurement;
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

applyMixins(ProcurementCollection, [Primitive, PrimitiveCollection]);
