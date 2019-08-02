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
import { ShipChainVault } from "../../src/shipchain/vaults/ShipChainVault";
import { PrimitiveType } from "../../src/shipchain/vaults/PrimitiveType";
import { Shipment } from "../../src/shipchain/vaults/primitives/Shipment";

@RPCNamespace({ name: 'Shipment' })
export class RPCShipment {

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

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);

        const content = await shipment.getShipmentData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipment: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'shipment'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            object: ['shipment'],
        },
    })
    public static async Set(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = (await vault.getPrimitive(PrimitiveType.Shipment.name)) as Shipment;
        await shipment.setShipmentData(wallet, args.shipment);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

}
