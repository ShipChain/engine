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

import { Wallet } from "../src/entity/Wallet";
import { LoadVault } from "../src/shipchain/LoadVault";
import { StorageCredential } from "../src/entity/StorageCredential";

import { RPCMethod } from "./decorators";
import { LoadedContracts } from "./contracts";
import { LoadContract } from "../src/shipchain/LoadContract";
import { TokenContract } from "../src/shipchain/TokenContract";
import { validateShipmentArgs } from "./validators";

const loadedContracts = LoadedContracts.Instance;

export class RPCLoad {

    @RPCMethod({
        require: ["storageCredentials", "shipperWallet", "carrierWallet"],
        validate: {
            uuid: ["storageCredentials", "shipperWallet", "carrierWallet"]
        }
    })
    public static async CreateVault(args) {

        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const shipperWallet = await Wallet.getById(args.shipperWallet);
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const vault = new LoadVault(storage);
        await vault.getOrCreateMetadata(shipperWallet);
        await vault.authorize(shipperWallet, "owners", carrierWallet.public_key);
        const signature = await vault.writeMetadata(shipperWallet);

        return {
            success: true,
            vault_id: vault.id,
            vault_signed: signature
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "carrierWallet"],
        validate: {
            uuid: ["shipperWallet", "carrierWallet"]
        }
    })
    public static async CreateShipmentTx(args) {

        const shipperWallet = await Wallet.getById(args.shipperWallet);
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.createNewShipmentTransaction(shipperWallet, carrierWallet, args.validUntil, args.fundingType, args.shipmentAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["updaterWallet", "shipmentId", "url", "hash"],
        validate: {
            uuid: ["updaterWallet"]
        }
    })
    public static async UpdateVaultHashTx(args) {

        const updaterWallet = await Wallet.getById(args.updaterWallet);

        if (args.url.length > 2000) {
            throw new Error("URL too long");
        }
        if (args.hash.length != 66 || !args.hash.startsWith("0x")) {
            throw new Error("Invalid vault hash format");
        }

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.updateVault(updaterWallet, args.shipmentId, args.url, args.hash);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "shipmentId", "depositAmount"],
        validate: {
            uuid: ["shipperWallet"]
        }
    })
    public static async FundEthTx(args) {

        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.depositEthTransaction(shipperWallet, args.shipmentId, args.depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "shipmentId", "depositAmount"],
        validate: {
            uuid: ["shipperWallet"]
        }
    })
    public static async FundCashTx(args) {

        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.depositCashTransaction(shipperWallet, args.shipmentId, args.depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "shipmentId", "depositAmount"],
        validate: {
            uuid: ["shipperWallet"]
        }
    })
    public static async FundShipTx(args) {

        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");
        const TOKEN_CONTRACT: TokenContract = <TokenContract> loadedContracts.get("Token");

        const txUnsigned = await LOAD_CONTRACT.depositShipTransaction(TOKEN_CONTRACT, shipperWallet, args.shipmentId, args.depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["committerWallet", "shipmentId"],
        validate: {
            uuid: ["committerWallet"]
        }
    })
    public static async CommitToShipmentTx(args) {

        const committerWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.commitToShipmentContract(committerWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["committerWallet", "shipmentId"],
        validate: {
            uuid: ["committerWallet"]
        }
    })
    public static async ShipmentInTransitTx(args) {

        const committerWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.inTransitByCarrier(committerWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["committerWallet", "shipmentId"],
        validate: {
            uuid: ["committerWallet"]
        }
    })
    public static async CarrierCompleteTx(args) {

        const committerWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.contractCompletedByCarrier(committerWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "shipmentId"],
        validate: {
            uuid: ["shipperWallet"]
        }
    })
    public static async ShipperAcceptTx(args) {

        const shipperWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.contractAcceptedByShipper(shipperWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["shipperWallet", "shipmentId"],
        validate: {
            uuid: ["shipperWallet"]
        }
    })
    public static async ShipperCancelTx(args) {

        const shipperWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.contractCancelledByShipper(shipperWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({
        require: ["payWallet", "shipmentId"],
        validate: {
            uuid: ["payWallet"]
        }
    })
    public static async PayOutTx(args) {

        const payWallet = await Wallet.getById(args[0]);

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        const txUnsigned = await LOAD_CONTRACT.payOut(payWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }

    @RPCMethod({require: ["shipmentId"]})
    public static async GetShipmentDetails(args) {

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetails(args.shipmentId)
        };
    }

    @RPCMethod({require: ["shipmentId"]})
    public static async GetShipmentDetailsContinued(args) {

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetailsContinued(args.shipmentId)
        };
    }

    @RPCMethod({require: ["shipmentId"]})
    public static async GetEscrowStatus(args) {

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        return {
            success: true,
            status: await LOAD_CONTRACT.getEscrowStatus(args.shipmentId)
        };
    }

    @RPCMethod({require: ["shipmentId"]})
    public static async GetContractFlags(args) {

        const LOAD_CONTRACT: LoadContract = <LoadContract> loadedContracts.get("LOAD");

        return {
            success: true,
            flags: await LOAD_CONTRACT.getContractFlags(args.shipmentId)
        };
    }

    @RPCMethod({
        require: ["credentials", "vaultWallet", "vaultId"],
        validate: {
            uuid: ["credentials", "vaultWallet", "vaultId"]
        }
    })
    public static async GetTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.credentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vaultId);
        const contents = await load.getTrackingData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vaultId,
            contents: contents
        };
    }

    @RPCMethod({
        require: ["credentials", "vaultWallet", "vaultId", "payload"],
        validate: {
            uuid: ["credentials", "vaultWallet", "vaultId"]
        }
    })
    public static async AddTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.credentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        if (args.payload == "") {
            throw new Error("Invalid Payload provided");
        }

        const load = new LoadVault(storage, args.vaultId);

        await load.getOrCreateMetadata(wallet);
        await load.addTrackingData(wallet, args.payload);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature
        };
    }

    @RPCMethod({
        require: ["credentials", "vaultWallet", "vaultId"],
        validate: {
            uuid: ["credentials", "vaultWallet", "vaultId"]
        }
    })
    public static async GetShipmentData(args) {
        const storage = await StorageCredential.getOptionsById(args.credentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vaultId);
        const contents = await load.getShipmentData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vaultId,
            shipment: contents
        };
    }

    @RPCMethod({
        require: ["credentials", "vaultWallet", "vaultId", "shipment"],
        validate: {
            uuid: ["credentials", "vaultWallet", "vaultId"]
        }
    })
    public static async AddShipmentData(args) {

        validateShipmentArgs(args.shipment);

        const storage = await StorageCredential.getOptionsById(args.credentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vaultId);

        await load.getOrCreateMetadata(wallet);
        await load.addShipmentData(wallet, args.shipment);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature
        };
    }

}