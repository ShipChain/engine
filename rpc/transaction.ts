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

const rpc = require('json-rpc2');

import { Wallet } from '../src/entity/Wallet';
import { BaseContract } from '../src/contracts/BaseContract';
import { TransmissionConfirmationCallback } from '../src/shipchain/TransmissionConfirmationCallback';

import { LoadedContracts } from './contracts';
import { RPCMethod } from './decorators';

const loadedContracts = LoadedContracts.Instance;

export class RPCTransaction {
    @RPCMethod({
        require: ['signerWallet', 'txUnsigned'],
        validate: {
            uuid: ['signerWallet'],
        },
    })
    public static async Sign(args) {
        if (typeof args.txUnsigned !== 'object') {
            // TODO: Validate arg as EthereumTx object
            throw new rpc.Error.InvalidParams('Invalid Ethereum Transaction format');
        }

        const signerWallet = await Wallet.getById(args.signerWallet);
        const [txSigned, txHash] = await signerWallet.sign_tx(args.txUnsigned);

        return {
            success: true,
            transaction: txSigned,
            hash: txHash
        };
    }

    @RPCMethod({ require: ['txSigned'] })
    public static async Send(args) {
        if (typeof args.txSigned !== 'object') {
            // TODO: Validate arg as EthereumTx object
            throw new rpc.Error.InvalidParams('Invalid Ethereum Transaction format');
        }

        let callbacks = new TransmissionConfirmationCallback(args.callbackUrl);

        // We don't need a specific version of the contract here, we
        // only need access to the network of a registered contract
        const LOAD_CONTRACT: BaseContract = loadedContracts.get('LOAD');
        const txReceipt = await LOAD_CONTRACT.sendTransaction(args.txSigned, callbacks);

        return {
            success: true,
            receipt: txReceipt,
        };
    }
}
