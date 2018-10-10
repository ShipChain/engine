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

import { Wallet } from '../../../src/entity/Wallet';

import { RPCMethod, RPCNamespace } from '../../decorators';
import { LoadedContracts } from '../../contracts';
import { LoadContract } from '../../../src/shipchain/contracts/Load/1.0.2/LoadContract';
import { TokenContract } from '../../../src/shipchain/contracts/Token/1.0.0/TokenContract';

const loadedContracts = LoadedContracts.Instance;

@RPCNamespace({ name: 'Load-1.0.2' })
export class RPCLoad {
    @RPCMethod({
        require: ['shipperWallet', 'carrierWallet'],
        validate: {
            uuid: ['shipperWallet', 'carrierWallet'],
        },
    })
    public static async CreateShipmentTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        // Creating a new Shipment always requires the latest version of the contract
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', "1.0.2");

        const txUnsigned = await LOAD_CONTRACT.createNewShipmentTransaction(
            shipperWallet,
            carrierWallet,
            args.validUntil,
            args.fundingType,
            args.shipmentAmount,
        );

        return {
            success: true,
            contractVersion: LOAD_CONTRACT.getContractVersion(),
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId', 'url', 'hash'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async UpdateVaultHashTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        if (args.url.length > 2000) {
            throw new Error('URL too long');
        }
        if (args.hash.length != 66 || !args.hash.startsWith('0x')) {
            throw new Error('Invalid vault hash format');
        }

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.updateVault(shipperWallet, args.shipmentId, args.url, args.hash);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId', 'depositAmount'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async FundEthTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.depositEthTransaction(
            shipperWallet,
            args.shipmentId,
            args.depositAmount,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId', 'depositAmount'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async FundCashTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.depositCashTransaction(
            shipperWallet,
            args.shipmentId,
            args.depositAmount,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId', 'depositAmount'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async FundShipTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);
        const TOKEN_CONTRACT: TokenContract = <TokenContract>loadedContracts.get('Token');

        const txUnsigned = await LOAD_CONTRACT.depositShipTransaction(
            TOKEN_CONTRACT,
            shipperWallet,
            args.shipmentId,
            args.depositAmount,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['carrierWallet', 'shipmentId'],
        validate: {
            uuid: ['carrierWallet'],
        },
    })
    public static async CommitToShipmentTx(args) {
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.commitToShipmentContract(carrierWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['carrierWallet', 'shipmentId'],
        validate: {
            uuid: ['carrierWallet'],
        },
    })
    public static async ShipmentInTransitTx(args) {
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.inTransitByCarrier(carrierWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['carrierWallet', 'shipmentId'],
        validate: {
            uuid: ['carrierWallet'],
        },
    })
    public static async CarrierCompleteTx(args) {
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.contractCompletedByCarrier(carrierWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async ShipperAcceptTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.contractAcceptedByShipper(shipperWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipperWallet', 'shipmentId'],
        validate: {
            uuid: ['shipperWallet'],
        },
    })
    public static async ShipperCancelTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.contractCancelledByShipper(shipperWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['carrierWallet', 'shipmentId'],
        validate: {
            uuid: ['carrierWallet'],
        },
    })
    public static async PayOutTx(args) {
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        const txUnsigned = await LOAD_CONTRACT.payOut(carrierWallet, args.shipmentId);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({ require: ['shipmentId'] })
    public static async GetShipmentDetails(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetails(args.shipmentId),
        };
    }

    @RPCMethod({ require: ['shipmentId'] })
    public static async GetShipmentDetailsContinued(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetailsContinued(args.shipmentId),
        };
    }

    @RPCMethod({ require: ['shipmentId'] })
    public static async GetEscrowStatus(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        return {
            success: true,
            status: await LOAD_CONTRACT.getEscrowStatus(args.shipmentId),
        };
    }

    @RPCMethod({ require: ['shipmentId'] })
    public static async GetContractFlags(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', args.contractVersion);

        return {
            success: true,
            flags: await LOAD_CONTRACT.getContractFlags(args.shipmentId),
        };
    }

}
