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
import * as Transaction from 'ethereumjs-tx';
import { RPCTransaction } from '../transaction';
import { mochaAsync, expectMissingRequiredParams, expectInvalidUUIDParams, resolveCallback } from './utils';

import { Wallet } from "../../src/entity/Wallet";
import { PrivateKeyDBFieldEncryption } from "../../src/entity/encryption/PrivateKeyDBFieldEncryption";

describe('RPC Transactions', function() {

    beforeAll(async () => {
        // read connection options from ormconfig file (or ENV variables)
        const connectionOptions = await typeorm.getConnectionOptions();
        await typeorm.createConnection({
            ...connectionOptions,
        });
        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());
    });

    describe('Sign', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await RPCTransaction.Sign({});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['signerWallet', 'txUnsigned']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await RPCTransaction.Sign({
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
                await new Promise((resolve, reject) => {
                    // @ts-ignore
                    RPCTransaction.Sign(
                        {
                            signerWallet: '00000000-0000-4000-8000-000000000000',
                            txUnsigned: 'Transaction Unsigned String',
                        }, null, resolveCallback(resolve, reject));
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toEqual('Invalid Ethereum Transaction format');
            }
        }));

        it(`Throws if Wallet not found`, mochaAsync(async () => {
            try {
                await new Promise((resolve, reject) => {
                    // @ts-ignore
                    RPCTransaction.Sign(
                        {
                            signerWallet: '00000000-0000-4000-8000-000000000000',
                            txUnsigned: {},
                        }, null, resolveCallback(resolve, reject));
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Returns Signed Transaction`, mochaAsync(async () => {
            const signer = await Wallet.generate_entity();
            await signer.save();
            try {
                const response: any = await new Promise((resolve, reject) => {
                    // @ts-ignore
                    RPCTransaction.Sign(
                        {
                            signerWallet: signer.id,
                            txUnsigned: {},
                        }, null, resolveCallback(resolve, reject));
                });

                expect(response).toBeTruthy();
                expect(response.success).toBeTruthy();
                expect(response.hash).toMatch(/^0x[a-f0-9]{64}$/);
                expect(response.transaction).toBeInstanceOf(Transaction);
            } catch (err){
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

});
