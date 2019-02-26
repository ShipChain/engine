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
    expectInvalidStringParams,
    CallRPCMethod,
} from "./utils";

import { RPCStorageCredentials } from '../storage_credentials';
import { StorageCredential } from "../../src/entity/StorageCredential";

describe('RPC StorageCredentials', function() {

    beforeAll(async () => {
        // read connection options from ormconfig file (or ENV variables)
        const connectionOptions = await typeorm.getConnectionOptions();
        await typeorm.createConnection({
            ...connectionOptions,
        });
    });

    describe('Create', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;
            const initialCount = await StorageCredential.count();

            try {
                await CallRPCMethod(RPCStorageCredentials.Create,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['title', 'driver_type']);
            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Validates String parameter`, mochaAsync(async () => {
            let caughtError;
            const initialCount = await StorageCredential.count();

            try {
                const result:any = await CallRPCMethod(RPCStorageCredentials.Create,{
                    title: {what: ['is', 'this']},
                    driver_type: 'local',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidStringParams(caughtError, ['title']);
            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Validates driver_type parameter`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                await CallRPCMethod(RPCStorageCredentials.Create,{
                    title: 'new title',
                    driver_type: 'INVALID',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Driver type: INVALID, not allowed!');
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Returns new StorageCredentials`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const response: any = await CallRPCMethod(RPCStorageCredentials.Create,{
                    title: 'new title',
                    driver_type: 'local',
                });
                expect(response.success).toBeTruthy();
                expect(response.credentials.title).toEqual('new title');
                expect(response.credentials.driver_type).toEqual('local');
                expect(response.credentials.base_path).toEqual('./');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount + 1);
        }));
    });

    describe('List', function() {
        it('Requires no parameters', mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const response: any = await CallRPCMethod(RPCStorageCredentials.List, null);
                expect(response.success).toBeTruthy();
                expect(response.credentials.length).toEqual(initialCount);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));
    });

    describe('TestAndStore', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;
            const initialCount = await StorageCredential.count();

            try {
                await CallRPCMethod(RPCStorageCredentials.TestAndStore,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['title', 'driver_type']);
            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Validates String parameter`, mochaAsync(async () => {
            let caughtError;
            const initialCount = await StorageCredential.count();

            try {
                const result:any = await CallRPCMethod(RPCStorageCredentials.TestAndStore,{
                    title: {what: ['is', 'this']},
                    driver_type: 'local',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidStringParams(caughtError, ['title']);
            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Validates driver_type parameter`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                await CallRPCMethod(RPCStorageCredentials.TestAndStore,{
                    title: 'new title',
                    driver_type: 'INVALID',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Driver type: INVALID, not allowed!');
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Returns Error on failed test`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const response: any = await CallRPCMethod(RPCStorageCredentials.TestAndStore,{
                    title: 'new title',
                    driver_type: 'sftp',
                    options: {
                        credentials: {
                            host: '__INVALID_HOST__',
                            port: '9999',
                        }
                    }
                });
                expect(response.valid).toBeFalsy();
                expect(response.message).toEqual('SFTP Connect: Error in Connection to Storage Driver [Invalid username]');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));

        it(`Returns new StorageCredentials on successful test`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const response: any = await CallRPCMethod(RPCStorageCredentials.TestAndStore,{
                    title: 'new title',
                    driver_type: 'local',
                });
                expect(response.success).toBeTruthy();
                expect(response.credentials.title).toEqual('new title');
                expect(response.credentials.driver_type).toEqual('local');
                expect(response.credentials.base_path).toEqual('./');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount + 1);
        }));
    });

    describe('Update', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCStorageCredentials.Update, null);
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCStorageCredentials.Update, {
                    storageCredentials: '123'
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials']);
        }));

        it(`Correctly modifies record`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const existingSC: StorageCredential = (await StorageCredential.find())[0];

                const response: any = await CallRPCMethod(RPCStorageCredentials.Update,{
                    storageCredentials: existingSC.id,
                    title: 'updated title',
                });
                expect(response.updated).toBeTruthy();
                expect((await StorageCredential.getById(existingSC.id)).title).toEqual('updated title');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));
    });

    describe('TestConnectivity', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCStorageCredentials.TestConnectivity, null);
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCStorageCredentials.TestConnectivity, {
                    storageCredentials: '123'
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials']);
        }));

        it(`Correctly modifies record`, mochaAsync(async () => {
            const initialCount = await StorageCredential.count();

            try {
                const existingSC: StorageCredential = (await StorageCredential.find())[0];

                const response: any = await CallRPCMethod(RPCStorageCredentials.TestConnectivity,{
                    storageCredentials: existingSC.id,
                });
                console.log(response);
                expect(response.valid).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }

            expect(await StorageCredential.count()).toEqual(initialCount);
        }));
    });
});