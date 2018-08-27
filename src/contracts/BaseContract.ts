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

import { Contract, Network } from '../entity/Contract';
import { Wallet } from '../entity/Wallet';
import { ContractCallback } from './ContractCallback';

export abstract class BaseContract {
    public Ready: Promise<any>;
    protected _network: Network;
    protected _contract: Contract;
    protected _eth;
    protected _utils;

    protected defaultGasLimit: number = 500000;

    protected constructor(contractName: string, network: string, version: string) {
        this.Ready = Contract.getContractVersion(contractName, network, version).then(contract => {
            this._contract = contract;
            this._network = contract.network;
            this._eth = this._network.getDriver().eth;
            this._utils = this._eth.extend.utils;
        });
    }

    getContractVersion() {
        return this._contract.version.title;
    }

    getEthDriver() {
        return this._eth;
    }

    async callStatic(method: string, args: any[], transform: boolean = false) {
        const staticResponse = await this._contract.call_static(method, args);

        let transformedResponse = staticResponse;

        if (transform) {
            transformedResponse = {};

            for (let property of Object.keys(staticResponse)) {
                if (property.startsWith('_')) {
                    transformedResponse[property.substring(1)] = staticResponse[property];
                }
            }
        }

        return transformedResponse;
    }

    async buildTransaction(method: string, args: any[], options?: any) {
        options = Object.assign({}, options, { gasLimit: this.defaultGasLimit });
        return await this._contract.build_transaction(method, args, options);
    }

    async buildTransactionForWallet(sender: Wallet, method: string, args: any[], options?: any) {
        const txParams = await this.buildTransaction(method, args, options);
        return await sender.add_tx_params(this._network, txParams);
    }

    async sendTransaction(txSigned, callbacks?: ContractCallback) {
        return await this._network.send_tx(txSigned, callbacks);
    }
}
