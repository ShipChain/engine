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

import { Wallet } from '../../../../entity/Wallet';
import { LoadContract as LoadContract_1_1_0, EscrowFundingType } from '../1.1.0/LoadContract';
import { ShipTokenContract } from '../../ShipToken/1.0.0/ShipTokenContract';

export class LoadContract extends LoadContract_1_1_0 {
    constructor(network: string, version: string) {
        super(network, version);
    }

    //@ts-ignore
    async createNewShipmentTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        fundingType: EscrowFundingType = EscrowFundingType.NO_FUNDING,
        contractedAmount: string = '0',
        carrierAddress: string = '0x0000000000000000000000000000000000000000',
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'createNewShipment', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            fundingType,
            contractedAmount,
            carrierAddress,
        ]);
    }

    async setVaultHashTx(senderWallet: Wallet, shipmentUuid: string, vaultHash: string) {
        throw new Error(
            'This version of LoadContract does not support' +
                ' setVaultHash, please use the setVaultHash in the ' +
                'VaultNotary contract.',
        );
    }
    async setVaultUriTx(senderWallet: Wallet, shipmentUuid: string, vaultUri: string) {
        throw new Error(
            'This version of LoadContract does not support' +
                ' setVaultUri, please use the setVaultUri in the ' +
                'VaultNotary contract.',
        );
    }

    //@ts-ignore
    async fundEscrowTx(
        tokenContract: ShipTokenContract,
        senderWallet: Wallet,
        shipmentUuid: string,
        depositAmount: string,
    ) {
        const escrowData = await this.callStatic('getEscrowData', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);

        if (escrowData.fundingType == EscrowFundingType.NO_FUNDING) {
            throw new Error('No escrow for shipment');
        }

        if (escrowData.fundingType == EscrowFundingType.SHIP) {
            return await this.fundEscrowShipTx(tokenContract, senderWallet, shipmentUuid, depositAmount);
        }

        if (escrowData.fundingType == EscrowFundingType.ETHER) {
            return await this.fundEscrowEtherTx(senderWallet, shipmentUuid, depositAmount);
        }

        throw new Error('Escrow funding type unknown');
    }

    //@ts-ignore
    async fundEscrowEtherTx(senderWallet: Wallet, shipmentUuid: string, depositAmount: string) {
        return await this.buildTransactionForWallet(
            senderWallet,
            'fundEscrowEther',
            [LoadContract.convertShipmentUuidToBytes16(shipmentUuid)],
            {
                value: depositAmount,
            },
        );
    }

    //@ts-ignore
    async fundEscrowShipTx(
        tokenContract: ShipTokenContract,
        senderWallet: Wallet,
        shipmentUuid: string,
        depositAmount: string,
    ) {
        return await tokenContract.approveAndCallTransaction(
            senderWallet,
            this._contract.address,
            depositAmount,
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        );
    }
}
