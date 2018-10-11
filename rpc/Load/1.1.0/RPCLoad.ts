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
import { EscrowFundingType, LoadContract } from "../../../src/shipchain/contracts/Load/1.1.0/LoadContract";
import { TokenContract } from '../../../src/shipchain/contracts/Token/1.0.0/TokenContract';

const loadedContracts = LoadedContracts.Instance;

@RPCNamespace({ name: 'Load-1.1.0' })
export class RPCLoad {

    @RPCMethod({
        require: ['shipmentUuid', 'shipperWallet'],
        validate: {
            uuid: ['shipmentUuid', 'shipperWallet'],
        },
    })
    public static async CreateShipmentTx(args) {
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        // Creating a new Shipment always requires the latest version of the contract
        const LOAD_CONTRACT: LoadContract = <LoadContract>loadedContracts.get('LOAD', "1.1.0");

        const txUnsigned = await LOAD_CONTRACT.createNewShipmentTransaction(
            shipperWallet,
            args.shipmentUuid,
            args.fundingType,
            args.contractedAmount,
        );

        return {
            success: true,
            contractVersion: LOAD_CONTRACT.getContractVersion(),
            transaction: txUnsigned,
        };
    }

}
