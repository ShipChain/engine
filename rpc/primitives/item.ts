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
import { Item, ItemProperties } from '../../src/shipchain/vaults/primitives/Item';

@RPCNamespace({ name: 'Item' })
export class RPCItem {
    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async Get(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const item: Item = await vault.getPrimitive(PrimitiveType.Item.name);

        const content: ItemProperties = await item.getItem(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            item: content,
        };
    }

    // FIELD ACCESS
    // ============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetFields(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const item: Item = await vault.getPrimitive(PrimitiveType.Item.name);

        const content = await item.getFields(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            fields: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'fields'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            object: ['fields'],
        },
    })
    public static async SetFields(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const item: Item = await vault.getPrimitive(PrimitiveType.Item.name);
        await item.setFields(wallet, args.fields);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // PRODUCT ACCESS
    // ==============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetProduct(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const item: Item = await vault.getPrimitive(PrimitiveType.Item.name);
        const content = await item.getProduct(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            product: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'productLink'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['productLink'],
        },
    })
    public static async SetProduct(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const item: Item = await vault.getPrimitive(PrimitiveType.Item.name);
        await item.setProduct(wallet, args.productLink);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }
}
