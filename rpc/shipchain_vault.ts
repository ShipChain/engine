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

import { Wallet } from '../src/entity/Wallet';
import { StorageCredential } from '../src/entity/StorageCredential';

import { RPCMethod, RPCNamespace } from './decorators';
import { ShipChainVault } from '../src/shipchain/vaults/ShipChainVault';

@RPCNamespace({ name: 'ShipChainVault' })
export class RPCShipChainVault {
    @RPCMethod({
        require: ['storageCredentials', 'shipperWallet'],
        validate: {
            uuid: ['storageCredentials', 'shipperWallet', 'carrierWallet'],
            stringArray: ['primitives'],
        },
    })
    public static async Create(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const vault = new ShipChainVault(storage);
        await vault.getOrCreateMetadata(shipperWallet);

        if (args.primitives && args.primitives.length) {
            for (let primitive of args.primitives) {
                vault.injectPrimitive(primitive);
            }
        }

        if (args.carrierWallet) {
            const carrierWallet = await Wallet.getById(args.carrierWallet);
            await vault.authorize(shipperWallet, ShipChainVault.OWNERS_ROLE, carrierWallet.public_key);
        }

        const vaultWriteResponse = await vault.writeMetadata(shipperWallet);

        return {
            ...vaultWriteResponse,
            success: true,
            vault_id: vault.id,
            vault_uri: vault.getVaultMetaFileUri(),
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'primitives'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            stringArray: ['primitives'],
        },
    })
    public static async InjectPrimitives(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        for (let primitive of args.primitives) {
            vault.injectPrimitive(primitive);
        }

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }
}
