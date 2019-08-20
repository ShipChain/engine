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

//import {LoadContract} from '../1.1.0/LoadContract' as LoadContract_1_1_0;
import { Wallet } from '../../../../entity/Wallet';
import { LoadContract } from '../1.1.0/LoadContract';

export enum EscrowFundingType {
    NO_FUNDING = 0,
    SHIP = 1,
    ETHER = 2,
}
export class LoadContract_1_2_0 extends LoadContract {
    constructor(network: string, version: string) {
        super(network, version);
    }

    async createNewShipment2Tx(
        senderWallet: Wallet,
        shipmentUuid: string,
        fundingType: EscrowFundingType = EscrowFundingType.NO_FUNDING,
        contractedAmount: number = 0,
        carrier: string,
    ) {
        return await this.buildTransactionForWallet(senderWallet, 'createNewShipment2', [
            LoadContract.convertShipmentUuidToBytes16(shipmentUuid),
            fundingType,
            contractedAmount,
            carrier,
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
}
