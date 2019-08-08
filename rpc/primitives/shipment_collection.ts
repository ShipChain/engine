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
import { ShipmentCollection } from '../../src/shipchain/vaults/primitives/ShipmentCollection';

@RPCNamespace({ name: 'ShipmentCollection' })
export class RPCShipmentCollection {
    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'linkId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['linkId'],
        },
    })
    public static async Get(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipments: ShipmentCollection = await vault.getPrimitive(PrimitiveType.ShipmentCollection.name);

        const content = await shipments.getShipment(args.linkId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipment: content,
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

        const shipments: ShipmentCollection = await vault.getPrimitive(PrimitiveType.ShipmentCollection.name);
        await shipments.addShipment(wallet, args.linkId, args.linkEntry);

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

        const shipments: ShipmentCollection = await vault.getPrimitive(PrimitiveType.ShipmentCollection.name);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            count: shipments.count(),
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

        const shipments: ShipmentCollection = await vault.getPrimitive(PrimitiveType.ShipmentCollection.name);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipment_collection: shipments.list(),
        };
    }
}