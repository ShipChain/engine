/*
 * Copyright 2019 ShipChain, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this content except in compliance with the License.
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

import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { ExternalListDailyContainer } from '../../../vaults/containers/ExternalDirectoryContainer';

export class Tracking extends ExternalListDailyContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Tracking.name, meta);
        this.injectContainerMetadata();
    }

    // TRACKING ACCESS
    // ===============
    async getTracking(wallet: Wallet): Promise<any> {
        return await this.decryptContents(wallet);
    }

    async addTracking(wallet: Wallet, tracking: any): Promise<void> {
        await this.append(wallet, tracking);
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
        return;
    }
}

applyMixins(Tracking, [Primitive]);
