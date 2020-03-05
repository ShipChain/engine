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
import { LoadContract } from '../../../src/shipchain/contracts/Load/1.2.0/LoadContract';
import { ShipTokenContract } from '../../../src/shipchain/contracts/ShipToken/1.0.0/ShipTokenContract';

const loadedContracts = LoadedContracts.Instance;
const PROJECT = 'LOAD';
const VERSION = '1.2.0';
const SHIPTOKEN_PROJECT = 'ShipToken';

@RPCNamespace({ name: 'Load.1.2.0' })
export class RPCLoad {
    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet', 'carrierWallet'],
            string: ['contractedAmount'],
        },
    })
    public static async CreateShipmentTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        let carrierWallet;
        if (args.carrierWallet) {
            carrierWallet = await Wallet.getById(args.carrierWallet);
        }

        // Creating a new Shipment always requires the latest version of the contract
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.createNewShipmentTx(
            senderWallet,
            args.shipmentUuid,
            args.fundingType,
            args.contractedAmount,
            carrierWallet ? await carrierWallet.evmAddress : undefined,
        );

        return {
            success: true,
            contractVersion: LOAD_CONTRACT.getContractVersion(),
            transaction: txUnsigned,
        };
    }

    // Transactional Methods
    // =====================

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet', 'carrierWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet', 'carrierWallet'],
        },
    })
    public static async SetCarrierTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const carrierWallet = await Wallet.getById(args.carrierWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.setCarrierTx(
            senderWallet,
            args.shipmentUuid,
            await carrierWallet.asyncEvmAddress,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet', 'moderatorWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet', 'moderatorWallet'],
        },
    })
    public static async SetModeratorTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const moderatorWallet = await Wallet.getById(args.moderatorWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.setModeratorTx(
            senderWallet,
            args.shipmentUuid,
            await moderatorWallet.asyncEvmAddress,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async SetInProgressTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.setInProgressTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async SetCompleteTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.setCompleteTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async SetCanceledTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.setCanceledTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet', 'depositAmount'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
            string: ['depositAmount'],
        },
    })
    public static async FundEscrowTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);
        const TOKEN_CONTRACT: ShipTokenContract = <ShipTokenContract>loadedContracts.get(SHIPTOKEN_PROJECT);

        const txUnsigned = await LOAD_CONTRACT.fundEscrowTx(
            TOKEN_CONTRACT,
            senderWallet,
            args.shipmentUuid,
            args.depositAmount,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet', 'depositAmount'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
            string: ['depositAmount'],
        },
    })
    public static async FundEscrowEtherTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.fundEscrowEtherTx(senderWallet, args.shipmentUuid, args.depositAmount);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet', 'depositAmount'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
            string: ['depositAmount'],
        },
    })
    public static async FundEscrowShipTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);
        const TOKEN_CONTRACT: ShipTokenContract = <ShipTokenContract>loadedContracts.get(SHIPTOKEN_PROJECT);

        const txUnsigned = await LOAD_CONTRACT.fundEscrowShipTx(
            TOKEN_CONTRACT,
            senderWallet,
            args.shipmentUuid,
            args.depositAmount,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async ReleaseEscrowTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.releaseEscrowTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async WithdrawEscrowTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.withdrawEscrowTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['shipmentUuid', 'senderWallet'],
        validate: {
            uuid: ['shipmentUuid', 'senderWallet'],
        },
    })
    public static async RefundEscrowTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await LOAD_CONTRACT.refundEscrowTx(senderWallet, args.shipmentUuid);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    // View Methods
    // ============

    @RPCMethod({
        require: ['shipmentUuid'],
        validate: {
            uuid: ['shipmentUuid'],
        },
    })
    public static async GetShipmentData(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        return {
            success: true,
            shipmentData: await LOAD_CONTRACT.getShipmentData(args.shipmentUuid),
        };
    }

    @RPCMethod({
        require: ['shipmentUuid'],
        validate: {
            uuid: ['shipmentUuid'],
        },
    })
    public static async GetEscrowData(args) {
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get(PROJECT, VERSION);

        return {
            success: true,
            escrowData: await LOAD_CONTRACT.getEscrowData(args.shipmentUuid),
        };
    }
}
