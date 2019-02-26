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
    CallRPCMethod,
    cleanupDeployedContracts
} from "./utils";

import { RPCWallet } from '../wallet';
import { loadContractFixtures } from "../contracts";
import { Wallet } from "../../src/entity/Wallet";
import { PrivateKeyDBFieldEncryption } from "../../src/entity/encryption/PrivateKeyDBFieldEncryption";

describe('RPC Wallets', function() {

    beforeAll(async () => {
        // read connection options from ormconfig file (or ENV variables)
        const connectionOptions = await typeorm.getConnectionOptions();
        await typeorm.createConnection({
            ...connectionOptions,
        });
        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());
        await loadContractFixtures();
    });

    afterAll(async() => {
        await cleanupDeployedContracts(typeorm);
    });

    describe('Create', function() {
        it(`Requires no parameters`, mochaAsync(async () => {
            const initialCount = await Wallet.count();

            try {
                const response: any = await CallRPCMethod(RPCWallet.Create, null);
                expect(response.success).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await Wallet.count()).toEqual(initialCount + 1);
        }));
    });

    describe('Import', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;
            const initialCount = await Wallet.count();

            try {
                await RPCWallet.Import({});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['privateKey']);
            expect(await Wallet.count()).toEqual(initialCount);
        }));

        it(`Validates PrivateKey format`, mochaAsync(async () => {
            const initialCount = await Wallet.count();

            try {
                await CallRPCMethod(RPCWallet.Import,{
                    privateKey: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('private key length is invalid');
            }

            expect(await Wallet.count()).toEqual(initialCount);
        }));

        it(`Generates correct wallet`, mochaAsync(async () => {
            const initialCount = await Wallet.count();

            try {
                const response: any = await CallRPCMethod(RPCWallet.Import,{
                    privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
                });
                expect(response.success).toBeTruthy();
                expect(response.wallet.address).toEqual('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
                expect(response.wallet.public_key).toEqual('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await Wallet.count()).toEqual(initialCount + 1);
        }));
    });

    describe('List', function() {
        it(`Requires no parameters`, mochaAsync(async () => {
            const initialCount = await Wallet.count();

            try {
                const response: any = await CallRPCMethod(RPCWallet.List, null);
                expect(response.success).toBeTruthy();
                expect(response.wallets.length).toEqual(initialCount);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await Wallet.count()).toEqual(initialCount);
        }));
    });

    describe('Balance', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCWallet.Balance, null);
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['wallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCWallet.Balance, {
                    wallet: '123'
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['wallet']);
        }));

        it(`Returns correct Balance`, mochaAsync(async () => {
            const initialCount = await Wallet.count();

            try {
                // Get existing wallet
                const imported: any = await CallRPCMethod(RPCWallet.Import,{
                    privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
                });

                const response: any = await CallRPCMethod(RPCWallet.Balance,{
                    wallet: imported.wallet.id,
                });
                expect(response.success).toBeTruthy();
                expect(response.ether).toEqual('158456325028528675187087900672');
                expect(response.ship).toEqual('0');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await Wallet.count()).toEqual(initialCount);
        }));
    });

});
