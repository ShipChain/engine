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
import { LoadVault } from '../src/shipchain/LoadVault';
import { StorageCredential } from '../src/entity/StorageCredential';

import { RPCMethod, RPCNamespace } from './decorators';
import { validateShipmentArgs } from './validators';


@RPCNamespace({ name: 'Vault' })
export class RPCVault {
    @RPCMethod({
        require: ['storageCredentials', 'shipperWallet'],
        validate: {
            uuid: ['storageCredentials', 'shipperWallet', 'carrierWallet'],
        },
    })
    public static async CreateVault(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const vault = new LoadVault(storage);
        await vault.getOrCreateMetadata(shipperWallet);

        if (args.carrierWallet) {
            const carrierWallet = await Wallet.getById(args.carrierWallet);
            await vault.authorize(shipperWallet, 'owners', carrierWallet.public_key);
        }

        const signature = await vault.writeMetadata(shipperWallet);

        return {
            success: true,
            vault_id: vault.id,
            vault_signed: signature,
            vault_uri: vault.getVaultMetaFileUri(),
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getTrackingData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            contents: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'payload'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async AddTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        if (args.payload == '') {
            throw new Error('Invalid Payload provided');
        }

        const load = new LoadVault(storage, args.vault);

        await load.getOrCreateMetadata(wallet);
        await load.addTrackingData(wallet, args.payload);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetShipmentData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getShipmentData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            shipment: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'shipment'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async AddShipmentData(args) {
        validateShipmentArgs(args.shipment);

        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.getOrCreateMetadata(wallet);
        await load.addShipmentData(wallet, args.shipment);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getDocument(wallet, args.documentName);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            document: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'documentContent'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async AddDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.getOrCreateMetadata(wallet);
        await load.addDocument(wallet, args.documentName, args.documentContent);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async ListDocuments(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.getOrCreateMetadata(wallet);
        const list = await load.listDocuments();

        return {
            success: true,
            documents: list,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async VerifyVault(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.getOrCreateMetadata(wallet);
        const verified = await load.verify();

        return {
            success: true,
            verified: verified,
        };
    }
}
