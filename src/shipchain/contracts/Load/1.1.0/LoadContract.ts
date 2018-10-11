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

    async createNewShipmentTransaction(
        shipperWallet: Wallet,
        shipmentUuid: string,
        fundingType: EscrowFundingType = EscrowFundingType.NO_FUNDING,
        contractedAmount: number = 0,
    ) {
        return await this.buildTransactionForWallet(shipperWallet, 'createNewShipment', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            fundingType,
            contractedAmount,
        ]);
    }

}
