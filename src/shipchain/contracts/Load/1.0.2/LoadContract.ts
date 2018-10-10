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

enum EscrowStatus {
    CONTRACT_INITIATED = 1,
    CONTRACT_COMMITTED = 2,
    CONTRACT_IN_TRANSIT = 3,
    CONTRACT_COMPLETED = 4,
    CONTRACT_ACCEPTED = 5,
    CONTRACT_CANCELLED = 6,
}

export enum FundingType {
    SHIP = 0,
    CASH = 1,
    ETH = 2,
}

export class LoadContract extends BaseContract {
    constructor(network: string, version: string) {
        super('LOAD', network, version);
    }

    async createNewShipmentTransaction(
        shipperWallet: Wallet,
        carrierWallet: Wallet,
        validUntil: number = 24,
        fundingType: FundingType = FundingType.ETH,
        shipmentAmount: number = 1,
    ) {
        return await this.buildTransactionForWallet(shipperWallet, 'createNewShipment', [
            shipperWallet.address,
            carrierWallet.address,
            validUntil,
            fundingType,
            shipmentAmount,
        ]);
    }

    async depositEthTransaction(shipperWallet: Wallet, shipmentId: number, value: number) {
        return await this.buildTransactionForWallet(shipperWallet, 'depositETH', [shipmentId], {
            gasLimit: this.defaultGasLimit,
            value: value,
        });
    }

    async depositCashTransaction(shipperWallet: Wallet, shipmentId: number, value: number) {
        return await this.buildTransactionForWallet(shipperWallet, 'depositCASH', [shipmentId, value]);
    }

    async depositShipTransaction(
        tokenContract: TokenContract,
        shipperWallet: Wallet,
        shipmentId: number,
        value: number,
    ) {
        const asciiToHexShipmentId = this._utils.asciiToHex('' + shipmentId);

        return await tokenContract.approveAndCallTransaction(
            shipperWallet,
            this._contract.address,
            value,
            asciiToHexShipmentId,
        );
    }

    async updateVault(shipperModeratorWallet: Wallet, shipmentId: number, url: string, hash: string) {
        return await this.buildTransactionForWallet(shipperModeratorWallet, 'UpdateVault', [shipmentId, url, hash]);
    }

    async commitToShipmentContract(carrierModeratorWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(carrierModeratorWallet, 'commitToShipmentContract', [shipmentId]);
    }

    async inTransitByCarrier(carrierModeratorWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(carrierModeratorWallet, 'inTransitByCarrier', [shipmentId]);
    }

    async contractCompletedByCarrier(carrierModeratorWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(carrierModeratorWallet, 'contractCompletedByCarrier', [shipmentId]);
    }

    async contractAcceptedByShipper(shipperWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(shipperWallet, 'contractAcceptedByShipper', [shipmentId]);
    }

    async contractCancelledByShipper(shipperWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(shipperWallet, 'contractCancelledByShipper', [shipmentId]);
    }

    async payOut(carrierModeratorWallet: Wallet, shipmentId: number) {
        return await this.buildTransactionForWallet(carrierModeratorWallet, 'payOut', [shipmentId]);
    }

    async getShipmentDetails(shipmentId: number) {
        return await this.callStatic('getShipmentContractDetails', [shipmentId], true);
    }

    async getShipmentDetailsContinued(shipmentId: number) {
        return await this.callStatic('getShipmentContractDetailsExtended', [shipmentId], true);
    }

    async getEscrowStatus(shipmentId: number) {
        let escrowNumber = await this.callStatic('getEscrowStatusEnumValue', [shipmentId]);
        return {
            escrow: escrowNumber,
            status: EscrowStatus[escrowNumber],
        };
    }

    async getContractFlags(shipmentId: number) {
        let flags = await this.callStatic('getShipmentContractFlags', [shipmentId]);
        return {
            shipment_created: flags[0],
            escrow_funded: flags[1],
            shipment_committed_by_carrier: flags[2],
            shipment_completed_by_carrier: flags[3],
            shipment_accepted_by_shipper: flags[4],
            shipment_canceled_by_shipper: flags[5],
            escrow_paid: flags[6],
        };
    }
}
