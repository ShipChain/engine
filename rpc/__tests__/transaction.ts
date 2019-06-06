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
const EthereumTx = require('ethereumjs-tx');
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    cleanupEntities,
    CallRPCMethod,
} from "./utils";

import { RPCTransaction } from '../transaction';
import { RPCLoad } from '../Load/1.1.0/RPCLoad';
import { Wallet } from "../../src/entity/Wallet";
import { PrivateKeyDBFieldEncryption } from "../../src/entity/encryption/PrivateKeyDBFieldEncryption";

export const RPCTransactions = async function() {

    let fullWallet;
    let txUnsigned;
    let txSigned;

    beforeEach(async () => {
        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());

        // Import known funded wallet
        fullWallet = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000001');
        await fullWallet.save();

        // Generate a transaction to sign/send
        txUnsigned = await CallRPCMethod(RPCLoad.CreateShipmentTx, {
            shipmentUuid: "77777777-25fe-465e-8458-0e9f8ffa2cdd",
            senderWallet: fullWallet.id,
        });
        txUnsigned = txUnsigned.transaction;

    }, 10000);

    afterAll(async() => {
        await cleanupEntities(typeorm);
    });

    describe('Sign', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCTransaction.Sign,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['signerWallet', 'txUnsigned']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCTransaction.Sign,{
                    signerWallet: '',
                    txUnsigned: {}
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['signerWallet']);
        }));

        it(`Validates TX Parameter is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCTransaction.Sign, {
                    signerWallet: '00000000-0000-4000-8000-000000000000',
                    txUnsigned: 'Transaction Unsigned String',
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toEqual('Invalid Ethereum Transaction format');
            }
        }));

        it(`Throws if Wallet not found`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCTransaction.Sign, {
                    signerWallet: '00000000-0000-4000-8000-000000000000',
                    txUnsigned: {},
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Returns Signed Transaction`, mochaAsync(async () => {
            try {
                const response: any = await CallRPCMethod(RPCTransaction.Sign, {
                    signerWallet: fullWallet.id,
                    txUnsigned: txUnsigned,
                });

                const txResponse = new EthereumTx(response.transaction);
                const validTx = txResponse.validate();

                expect(response).toBeDefined();
                expect(response.success).toBeTruthy();
                expect(response.hash).toMatch(/^0x[a-f0-9]{64}$/);
                expect(validTx).toBeTruthy();
                txSigned = txResponse;
            } catch (err){
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('Send', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCTransaction.Send,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['txSigned']);
        }));

        it(`Validates TX Parameter is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCTransaction.Send, {
                    txSigned: 'Transaction Unsigned String',
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toEqual('Invalid Ethereum Transaction format');
            }
        }));

        it(`Returns Transaction Receipt`, mochaAsync(async () => {
            try {
                const response: any = await CallRPCMethod(RPCTransaction.Send, {
                    txSigned: txSigned,
                });

                expect(response).toBeDefined();
                expect(response.success).toBeTruthy();
                expect(response.receipt).toBeDefined()
            } catch (err){
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
