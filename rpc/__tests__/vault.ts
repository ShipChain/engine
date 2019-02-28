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

const fs = require('fs');

import 'mocha';
import * as typeorm from "typeorm";
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    expectInvalidDateParams,
    cleanupEntities,
    CallRPCMethod,
} from "./utils";

import { buildSchemaValidators } from "../validators";
import { RPCVault } from '../vault';
import { uuidv4 } from "../../src/utils";
import { StorageCredential } from "../../src/entity/StorageCredential";
import { Wallet } from "../../src/entity/Wallet";
import { PrivateKeyDBFieldEncryption } from "../../src/entity/encryption/PrivateKeyDBFieldEncryption";

const DATE_0 = '2018-01-01T00:00:00.000Z';
const DATE_1 = '2018-01-01T01:00:00.000Z';
const DATE_2 = '2018-01-01T02:00:00.000Z';
const DATE_3 = '2018-01-01T03:00:00.000Z';
const DATE_4 = '2018-01-01T04:00:00.000Z';

export const RPCVaultTests = async function() {
    const RealDate = Date;

    function mockDate(isoDate) {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super();
                return new RealDate(isoDate);
            }
        };
    }

    function resetDate() {
        // @ts-ignore
        global.Date = RealDate;
    }


    let fullWallet1;
    let fullWallet2;
    let localStorage;

    let testableLocalVaultId;
    let emptyLocalVaultId;

    let knownShipmentSchemaId = uuidv4();
    let knownDocumentContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mN8U+T4nYEIwDiqkL4KAZKnGefMCAbPAAAAAElFTkSuQmCC';

    beforeAll(async () => {
        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());

        // Import known funded wallets
        fullWallet1 = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000001');
        await fullWallet1.save();
        fullWallet2 = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000002');
        await fullWallet2.save();

        localStorage = await StorageCredential.generate_entity({
            title: 'local',
            driver_type: 'local',
        });
        await localStorage.save();

        await buildSchemaValidators();

    });

    beforeEach(async () => {
        mockDate(DATE_1);
    });

    afterEach(async () => {
        resetDate();
    });


    afterAll(async() => {
        await cleanupEntities(typeorm);
    });

    describe('CreateVault', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.CreateVault, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'shipperWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: '123',
                    shipperWallet: '123',
                    carrierWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'shipperWallet', 'carrierWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: '123',
                    shipperWallet: '123',
                    carrierWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'shipperWallet', 'carrierWallet']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: uuidv4(),
                    shipperWallet: fullWallet1.id,
                    carrierWallet: fullWallet2.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: localStorage.id,
                    shipperWallet: uuidv4(),
                    carrierWallet: fullWallet2.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Carrier exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: localStorage.id,
                    shipperWallet: fullWallet1.id,
                    carrierWallet: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Creates new Vault`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: localStorage.id,
                    shipperWallet: fullWallet1.id,
                    carrierWallet: fullWallet2.id,
                });

                expect(result.success).toBeTruthy();
                expect(result.vault_id).toBeDefined();
                expect(result.vault_signed).toBeDefined();
                expect(result.vault_signed.author).toEqual(fullWallet1.public_key);
                expect(result.vault_signed.hash).toBeDefined();
                expect(result.vault_signed.at).toBeDefined();
                expect(result.vault_signed.signature).toBeDefined();
                expect(result.vault_signed.alg).toEqual('sha256');
                expect(result.vault_uri).toBeDefined();
                expect(fs.existsSync(`./${result.vault_id}/meta.json`)).toBeTruthy();

                // Save this vault_id for use in later tests
                testableLocalVaultId = result.vault_id;

                // Create empty vault for later tests
                const emptyVaultResult: any = await CallRPCMethod(RPCVault.CreateVault, {
                    storageCredentials: localStorage.id,
                    shipperWallet: fullWallet1.id,
                    carrierWallet: fullWallet2.id,
                });
                emptyLocalVaultId = emptyVaultResult.vault_id;
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddTrackingData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'payload']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    payload: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    payload: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    payload: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    payload: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates Payload is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    payload: 'a string',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid Object: 'payload'`);
            }

            try {
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    payload: [],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid Object: 'payload'`);
            }
        }));

        it(`Adds new data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    payload: {
                        some: 'data'
                    },
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(fs.existsSync(`./${testableLocalVaultId}/tracking/20180101.json`)).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetTrackingData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetTrackingData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Returns empty array when no tracking data exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.contents).toEqual([]);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns correct tracking data when exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.GetTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.contents).toEqual([{
                    some: 'data'
                }]);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddShipmentData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'shipment']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    shipment: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    shipment: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    shipment: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates Shipment is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: 'a string',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid Object: 'shipment'`);
            }

            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: [],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid Object: 'shipment'`);
            }
        }));

        it(`Validates Shipment matches schema`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: {
                        id: uuidv4(),
                        version: '0.0.1',
                        invalid_shipment_field: 'Fail',
                    },
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Shipment Invalid: data should NOT have additional properties`);
            }
        }));

        it(`Adds new data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.1',
                    },
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetShipmentData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when no tracking data exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Container contents empty`);
            }
        }));

        it(`Returns correct tracking data when exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.GetShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.shipment).toEqual({
                    id: knownShipmentSchemaId,
                    version: '0.0.1',
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'documentContent']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentName: 'test.png',
                    documentContent: knownDocumentContent,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    documentContent: knownDocumentContent,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    documentContent: knownDocumentContent,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentName: 'test.png',
                    documentContent: knownDocumentContent,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates documentName is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: {},
                    documentContent: knownDocumentContent,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid String: 'documentName'`);
            }
        }));

        it(`Validates documentContent is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    documentContent: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid String: 'documentContent'`);
            }
        }));

        it(`Adds new data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    documentContent: knownDocumentContent,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(fs.existsSync(`./${testableLocalVaultId}/documents/test.png.json`)).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentName']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentName: 'test.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentName: 'test.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates documentName is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid String: 'documentName'`);
            }
        }));

        it(`Throws no document exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                    documentName: 'test.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unauthorized access to vault contents`);
            }
        }));

        it(`Returns correct document data when exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                });
                expect(result.success).toBeTruthy();
                expect(result.document).toEqual(knownDocumentContent);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('ListDocuments', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.ListDocuments, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.ListDocuments, {
                    storageCredentials: '123',
                    vault: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.ListDocuments, {
                    storageCredentials: uuidv4(),
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws no document exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vault: emptyLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([]);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns correct document data when exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vault: testableLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([{
                    name: "test.png",
                }]);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('VerifyVault', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.VerifyVault, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.VerifyVault, {
                    storageCredentials: '123',
                    vault: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.VerifyVault, {
                    storageCredentials: uuidv4(),
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.VerifyVault, {
                    storageCredentials: localStorage.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Returns vault verification boolean`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.VerifyVault, {
                    storageCredentials: localStorage.id,
                    vault: testableLocalVaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.verified).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetHistoricalShipmentData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'date']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates Date parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: 'Jan 1st, 2018',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidDateParams(caughtError, ['date']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when no data exists for date`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                    date: DATE_0,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`No data found for date`);
            }
        }));

        it(`Returns latest data when exists`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.1',
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns intermediate data when exists`, mochaAsync(async () => {
            try {
                // Add new data at DATE_3
                mockDate(DATE_3);
                await CallRPCMethod(RPCVault.AddShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.2',
                    },
                });
                resetDate(); // <-- Very important!

                // Check data at DATE_2 is still previous data
                let result: any = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });

                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.1',
                    },
                });

                // Check data at DATE_4 is most recent
                result = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_4,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_3,
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.2',
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
