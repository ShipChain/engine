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
import { BaseContract } from '../../../../contracts/BaseContract';
import { TokenContract } from '../../Token/1.0.0/TokenContract';

export enum EscrowFundingType {
    NO_FUNDING = 0,
    SHIP = 1,
    ETHER = 2,
}

export enum EscrowState {
    NOT_CREATED = 0,
    CREATED = 1,
    FUNDED = 2,
    RELEASED = 3,
    REFUNDED = 4,
    WITHDRAWN = 5,
}

export enum ShipmentState {
    NOT_CREATED = 0,
    CREATED = 1,
    IN_PROGRESS = 2,
    COMPLETE = 3,
    CANCELED = 4,
}

export class LoadContract extends BaseContract {
    constructor(network: string, version: string) {
        super('LOAD', network, version);
    }

    protected static convertShipmentUuidToBytes16(shipmentUuid: string): string {
        return "0x" + shipmentUuid.replace(/-/g,"");
    }

    async createNewShipmentTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        fundingType: EscrowFundingType = EscrowFundingType.NO_FUNDING,
        contractedAmount: number = 0,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'createNewShipment', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            fundingType,
            contractedAmount,
        ]);
    }

    // Transactional Methods
    // =====================

    async setVaultUriTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        vaultUri: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultUri', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            vaultUri,
        ]);
    }

    async setVaultHashTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        vaultHash: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultHash', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            vaultHash,
        ]);
    }

    async setCarrierTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        carrier: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setCarrier', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            carrier,
        ]);
    }

    async setModeratorTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        moderator: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setModerator', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            moderator,
        ]);
    }

    async setInProgressTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setInProgress', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async setCompleteTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setInProgress', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async setCanceledTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'setCanceled', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async fundEscrowTx(
        tokenContract: TokenContract,
        senderWallet: Wallet,
        shipmentUuid: string,
        depositAmount: number,
    ) {
        const escrowData = await this.callStatic('getEscrowData', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);

        if(escrowData.fundingType == EscrowFundingType.NO_FUNDING){
            throw new Error("No escrow for shipment");
        }

        if(escrowData.fundingType == EscrowFundingType.SHIP){
            return await this.fundEscrowShipTx(tokenContract, senderWallet, shipmentUuid, depositAmount);
        }

        if(escrowData.fundingType == EscrowFundingType.ETHER){
            return await this.fundEscrowEtherTx(senderWallet, shipmentUuid, depositAmount);
        }

        throw new Error("Escrow funding type unknown");
    }

    async fundEscrowEtherTx(
        senderWallet: Wallet,
        shipmentUuid: string,
        depositAmount: number,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'fundEscrowEther', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ],
        {
            gasLimit: this.defaultGasLimit,
            value: depositAmount,
        });
    }

    async fundEscrowShipTx(
        tokenContract: TokenContract,
        senderWallet: Wallet,
        shipmentUuid: string,
        depositAmount: number,
    ) {
        const shipmentId = LoadContract.convertShipmentUuidToBytes16(shipmentUuid);
        const asciiToHexShipmentUuid = this._utils.asciiToHex('' + shipmentId);

        return await tokenContract.approveAndCallTransaction(
            senderWallet,
            this._contract.address,
            depositAmount,
            asciiToHexShipmentUuid,
        );
    }

    async releaseEscrowTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'releaseEscrow', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async withdrawEscrowTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'withdrawEscrow', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async refundEscrowTx(
        senderWallet: Wallet,
        shipmentUuid: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'refundEscrow', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    // View Methods
    // ============

    async getShipmentData(shipmentUuid: string) {
        return await this.callStatic('getShipmentData', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

    async getEscrowData(shipmentUuid: string) {
        return await this.callStatic('getEscrowData', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
        ]);
    }

}
