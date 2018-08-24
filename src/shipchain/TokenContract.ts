/*
 * Copyright 2018 ShipChain, Inc.
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

import { Wallet } from '../entity/Wallet';
import { BaseContract } from '../contracts/BaseContract';

export class TokenContract extends BaseContract {
    constructor(network: string, version: string) {
        super('ShipToken', network, version);
    }

    async approveAndCallTransaction(
        shipperWallet: Wallet,
        contractAddress: string,
        tokenAmount: number,
        callbackArguments: number[],
    ) {
        const txMethod = await this.buildTransaction('approveAndCall', [
            contractAddress,
            tokenAmount,
            callbackArguments,
        ]);

        return await shipperWallet.add_tx_params(this._network, txMethod);
    }
}
