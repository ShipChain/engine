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

require('./testLoggingConfig');

import 'mocha';
import { Wallet } from '../entity/Wallet';
import { Contract, Version, Project, Network } from '../entity/Contract';
import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AbstractEthereumService } from "../eth/AbstractEthereumService";
import { LoomHooks } from "../eth/LoomHooks";

const utils = require('../local-test-net-utils');

// These are the versions we are testing
const LATEST_SHIPTOKEN = "1.0.0";
const LATEST_LOAD = "1.2.0";
const LATEST_NOTARY = "1.0.0";


export const ContractEntityTests = async function() {

    beforeAll(async () => {
        await EncryptorContainer.init();
    });

    it(`loads contract fixtures`, async () => {
        await Project.loadFixturesFromFile('/app/src/__tests__/meta.json');
        expect(await Project.count()).toEqual(3);
        expect(await Network.count()).toEqual(3);
        expect(await Version.count()).toEqual(5);
        expect(await Contract.count()).toEqual(9);
    });

    it(
        `can copy ShipToken to local test net`,
        async () => {
            await Project.loadFixturesFromFile('/app/src/__tests__/meta.json');
            const owner = await Wallet.generate_entity();
            const other = await Wallet.generate_entity();

            const local = await utils.setupLocalTestNetContracts({ ShipToken: LATEST_SHIPTOKEN, LOAD: LATEST_LOAD, NOTARY: LATEST_NOTARY }, [owner]);
            const network: Network = await Network.getLocalTestNet();
            const ethereumService: AbstractEthereumService = network.getEthereumService();

            const ownerBalance = await local.ShipToken.call_static('balanceOf', [await owner.asyncEvmAddress]);
            expect(ownerBalance).toEqual(ethereumService.unitToWei(500, 'ether'));

            if (!LoomHooks.enabled) {
                expect(await ethereumService.getBalance(await owner.asyncEvmAddress)).toEqual(ethereumService.unitToWei(5, 'ether').toString());
            }

            const txParams = await owner.add_tx_params(
                network,
                await local.ShipToken.build_transaction('transfer', [await other.asyncEvmAddress, ethereumService.unitToWei(100, 'ether').toString()]),
            );

            const [signed_tx, txHash] = await owner.sign_tx(txParams);

            const receipt: any = await network.send_tx(signed_tx);

            expect(receipt.transactionHash.length).toEqual(66);

            const new_owner_balance = await local.ShipToken.call_static('balanceOf', [await owner.asyncEvmAddress]);
            const new_other_balance = await local.ShipToken.call_static('balanceOf', [await other.asyncEvmAddress]);

            expect(new_owner_balance).toEqual(ethereumService.unitToWei(400, 'ether'));

            expect(new_other_balance).toEqual(ethereumService.unitToWei(100, 'ether'));
        },
        180000,
    );
};
