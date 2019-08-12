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
import { Procurement, ProcurementProperties } from '../../src/shipchain/vaults/primitives/Procurement';

@RPCNamespace({ name: 'Procurement' })
export class RPCProcurement {
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

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);

        const content: ProcurementProperties = await procurement.getProcurement(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            procurement: content,
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

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);

        const content = await procurement.getFields(wallet);

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

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        await procurement.setFields(wallet, args.fields);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // SHIPMENT ACCESS
    // ===============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async ListShipments(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content: string[] = await procurement.listShipments(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipments: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetShipment(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content = await procurement.getShipment(wallet, args.shipmentId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            shipment: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId', 'shipmentLink'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId'],
            string: ['shipmentLink'],
        },
    })
    public static async AddShipment(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        await procurement.addShipment(wallet, args.shipmentId, args.shipmentLink);

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
    public static async ListDocuments(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content: string[] = await procurement.listDocuments(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            documents: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'documentId'],
        },
    })
    public static async GetDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content = await procurement.getDocument(wallet, args.documentId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            document: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentId', 'documentLink'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'documentId'],
            string: ['documentLink'],
        },
    })
    public static async AddDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        await procurement.addDocument(wallet, args.documentId, args.documentLink);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }

    // PRODUCTS ACCESS
    // ===============

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async ListProducts(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content = await procurement.listProducts(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            products: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'productId'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'productId'],
        },
    })
    public static async GetProduct(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        const content = await procurement.getProduct(wallet, args.productId);

        return {
            success: true,
            wallet_id: wallet.id,
            vault_id: args.vault,
            product: content,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'productId', 'productLink', 'quantity'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault', 'productId'],
            number: ['quantity'],
            string: ['productLink'],
        },
    })
    public static async AddProduct(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const vault = new ShipChainVault(storage, args.vault);
        await vault.loadMetadata();

        const procurement: Procurement = await vault.getPrimitive(PrimitiveType.Procurement.name);
        await procurement.addProduct(wallet, args.productId, args.productLink, args.quantity);

        const vaultWriteResponse = await vault.writeMetadata(wallet);

        return {
            ...vaultWriteResponse,
            success: true,
        };
    }
}
