/*
 * Copyright 2019 ShipChain, Inc.
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




require('../../src/__tests__/testLoggingConfig');

import 'mocha';
import * as typeorm from "typeorm";
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    cleanupEntities,
    CallRPCMethod 
} from "./utils";

import { RPCVaultNotary } from '../VaultNotary/1.0.0/RPCVaultNotary';
import { uuidv4 } from "../../src/utils";
import { Wallet } from "../../src/entity/Wallet";
import { EncryptorContainer } from '../../src/entity/encryption/EncryptorContainer';
import { latest as LATEST_NOTARY } from '../VaultNotary/Latest';

export const RPCVaultNotaryTests = async function() {

    let fullWallet1;
    let fullWallet2;

    beforeAll(async () => {
        await EncryptorContainer.init();
        // Import known funded wallets
        fullWallet1 = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000001');
        await fullWallet1.save();
        fullWallet2 = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000002');
        await fullWallet2.save();
    });

    beforeEach(async () => {
    });

    afterEach(async () => {
    });


    afterAll(async() => {
        await cleanupEntities(typeorm);
    });

    describe('RegisterVault', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RegisterVaultTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'vaultUri', 'vaultHash']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RegisterVaultTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    vaultUri: '123',
                    vaultHash: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.RegisterVaultTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultUri: '123',
                    vaultHash: '123'
                });
                
                expect(rpcReturn).toBeDefined();
                expect(rpcReturn.success).toBeTruthy();
                expect(rpcReturn.transaction.nonce).toBeDefined();
                expect(rpcReturn.transaction.gasPrice).toBeDefined();
                expect(rpcReturn.transaction.gasLimit).toBeDefined();
                expect(rpcReturn.transaction.value).toBeDefined();
                expect(rpcReturn.transaction.data).toBeDefined();
                expect(rpcReturn.transaction.to).toBeDefined();
                expect(rpcReturn.transaction.chainId).toBeDefined();
                expect(rpcReturn.contractVersion).toMatch(LATEST_NOTARY);
 
        }));
 

    });

};
