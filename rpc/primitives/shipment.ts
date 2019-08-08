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
import { Shipment, ShipmentProperties } from '../../src/shipchain/vaults/primitives/Shipment';
import { validateShipmentArgs } from '../validators';

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

        const content: ShipmentProperties = await shipment.getShipment(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipment: content,
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

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);

        const content = await shipment.getFields(wallet);

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
        validateShipmentArgs(args.shipment);

        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        await shipment.setFields(wallet, args.shipment);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // DOCUMENT ACCESS
    // ===============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async ListDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        const content: string[] = await shipment.listDocuments(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            documents: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['documentName'],
        },
    })
    public static async GetDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        const content = await shipment.getDocument(wallet, args.documentName);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            document: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'documentLink'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['documentName', 'documentLink'],
        },
    })
    public static async AddDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        await shipment.addDocument(wallet, args.documentName, args.documentLink);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // TRACKING ACCESS
    // ===============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetTracking(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        const content = await shipment.getTracking(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            tracking: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'trackingLink'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['trackingLink'],
        },
    })
    public static async SetTracking(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        await shipment.setTracking(wallet, args.trackingLink);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // ITEMS ACCESS
    // ============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async ListItems(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        const content = await shipment.listItems(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            items: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'itemId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'itemId'],
        },
    })
    public static async GetItem(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        const content = await shipment.getItem(wallet, args.itemId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            item: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'itemId', 'itemLink', 'quantity'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'itemId'],
            number: ['quantity'],
            string: ['itemLink'],
        },
    })
    public static async AddItem(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const shipment: Shipment = await vault.getPrimitive(PrimitiveType.Shipment.name);
        await shipment.addItem(wallet, args.itemId, args.itemLink, args.quantity);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }
}
