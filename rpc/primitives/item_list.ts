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

import { Wallet } from '../../src/entity/Wallet';
import { StorageCredential } from '../../src/entity/StorageCredential';

import { RPCMethod, RPCNamespace } from '../decorators';
import { ShipChainVault } from '../../src/shipchain/vaults/ShipChainVault';
import { PrimitiveType } from '../../src/shipchain/vaults/PrimitiveType';
import { ItemList } from '../../src/shipchain/vaults/primitives/ItemList';
import { RemoteVault } from '../../src/vaults/RemoteVault';

@RPCNamespace({ name: 'ItemList' })
export class RPCItemList {
    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'linkId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'linkId'],
        },
    })
    public static async Get(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const items: ItemList = await vault.getPrimitive(PrimitiveType.ItemList.name);

        const content = await items.getEntity(args.linkId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            item: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'linkId', 'linkEntry'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'linkId'],
        },
    })
    public static async Add(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const items: ItemList = await vault.getPrimitive(PrimitiveType.ItemList.name);
        if (typeof args.linkEntry === 'string') {
            args.linkEntry = RemoteVault.buildLinkEntry(args.linkEntry);
            if (!args.linkEntry) {
                throw new Error(`Invalid LinkEntry provided`);
            }
        }
        await items.addEntity(wallet, args.linkId, args.linkEntry);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async Count(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const items: ItemList = await vault.getPrimitive(PrimitiveType.ItemList.name);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            count: items.count(),
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async List(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const items: ItemList = await vault.getPrimitive(PrimitiveType.ItemList.name);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            item_list: items.list(),
        };
    }
}
