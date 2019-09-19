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

import { Wallet } from '../src/entity/Wallet';
import { BaseContract } from '../src/contracts/BaseContract';
import { MetricsReporter } from '../src/MetricsReporter';
import { LoadedContracts } from './contracts';
import { RPCMethod, RPCNamespace } from './decorators';

const loadedContracts = LoadedContracts.Instance;
const metrics = MetricsReporter.Instance;

@RPCNamespace({ name: 'Wallet' })
export class RPCWallet {
    @RPCMethod()
    public static async Create() {
        const wallet = await Wallet.generate_entity();
        await wallet.save();

        // This should be non-blocking
        Wallet.getCount()
            .then(count => {
                metrics.entityTotal('Wallet', count);
            })
            .catch(err => {});

        return {
            success: true,
            wallet: {
                id: wallet.id,
                public_key: wallet.public_key,
                address: wallet.address,
            },
        };
    }

    @RPCMethod({ require: ['privateKey'] })
    public static async Import(args) {
        const wallet = await Wallet.import_entity(args.privateKey);
        await wallet.save();

        // This should be non-blocking
        Wallet.getCount()
            .then(count => {
                metrics.entityTotal('Wallet', count);
            })
            .catch(err => {});

        return {
            success: true,
            wallet: {
                id: wallet.id,
                public_key: wallet.public_key,
                address: wallet.address,
            },
        };
    }

    @RPCMethod()
    public static async List() {
        const wallets: Wallet[] = await Wallet.listAll();

        return {
            success: true,
            wallets: wallets,
        };
    }

    @RPCMethod({
        require: ['wallet'],
        validate: {
            uuid: ['wallet'],
        },
    })
    public static async Balance(args) {
        const wallet = await Wallet.getById(args.wallet);

        const TOKEN_CONTRACT: BaseContract = loadedContracts.get('ShipToken');
        const ethereumService = TOKEN_CONTRACT.getEthereumService();

        const eth_balance = await ethereumService.getBalance(wallet.address);
        const ship_balance = await TOKEN_CONTRACT.callStatic('balanceOf', [wallet.address]);

        return {
            success: true,
            ether: eth_balance,
            ship: ship_balance,
        };
    }
}
