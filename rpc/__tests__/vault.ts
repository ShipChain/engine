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
import * as path from 'path';
const AWS = require('aws-sdk');
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    expectInvalidDateParams,
    expectInvalidNumberParams,
    expectInvalidParameterCombinationParams,
    cleanupEntities,
    CallRPCMethod,
} from "./utils";

import { buildSchemaValidators } from "../validators";
import { RPCVault } from '../vault';
import { uuidv4, signObject } from "../../src/utils";
import { StorageCredential } from "../../src/entity/StorageCredential";
import { Wallet } from "../../src/entity/Wallet";
import { EncryptorContainer } from '../../src/entity/encryption/EncryptorContainer';

const DATE_0 = '2018-01-01T00:00:00.000Z';
const DATE_1 = '2018-01-01T01:00:00.000Z';
const DATE_2 = '2018-01-01T02:00:00.000Z';
const DATE_3 = '2018-01-01T03:00:00.000Z';
const DATE_4 = '2018-01-01T04:00:00.000Z';
const dummyId = 'e7721042-7ee1-4d92-93db-c9544b454abf';
const oldVersion = '0.0.1';
const newVersion = '0.0.2';
let vaultToMigrate = {
    containers: {
        tracking: {
            container_type: "external_list_daily",
            roles: ["owners"]
        }
    },
    roles: {
        owners: { public_key: "" },
        ledger: { public_key: ""}
    },
    created: DATE_1,
    id: dummyId,
    version: oldVersion
};

export const RPCVaultTests = async function() {
    const RealDate = Date;
    const RealAwsS3 = AWS.S3;

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
    let vaultDir;
    let signedVaultToMigrate;

    let knownShipmentSchemaId = uuidv4();
    let knownDocumentContentb64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mN8U+T4nYEIwDiqkL4KAZKnGefMCAbPAAAAAElFTkSuQmCC';
    let knownDocumentContent = `data:image/png;base64,${knownDocumentContentb64}`;

    beforeAll(async () => {
        await EncryptorContainer.init();

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

        const role = Wallet.generate_identity();
        const key1 = await Wallet.encrypt_to_string(fullWallet1.public_key, role.privateKey);
        const key2 = await Wallet.encrypt_to_string(fullWallet1.public_key, role.privateKey);
        vaultToMigrate.roles.owners["public_key"] = role.publicKey;
        vaultToMigrate.roles.owners[fullWallet1.public_key] = key1;
        vaultToMigrate.roles.ledger["public_key"] = role.publicKey;
        vaultToMigrate.roles.ledger[fullWallet1.public_key] = key2;
        signedVaultToMigrate = JSON.stringify(signObject(fullWallet1, vaultToMigrate));
        vaultDir = `/app/${dummyId}/`;
        fs.mkdirSync(vaultDir, {recursive: true});
        fs.writeFileSync(`${vaultDir}/meta.json`, signedVaultToMigrate);

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
        AWS.S3.mockRestore();
        AWS.S3 = RealAwsS3;
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`Invalid Object: 'payload'`);
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
                expect(err.message).toContain(`Invalid Object: 'payload'`);
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
                expect(result.vault_revision).toEqual(1);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`Invalid Object: 'shipment'`);
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
                expect(err.message).toContain(`Invalid Object: 'shipment'`);
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
                expect(err.message).toContain(`Shipment Invalid: data should NOT have additional properties`);
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
                expect(result.vault_revision).toEqual(2);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`Container contents empty`);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`Invalid String: 'documentName'`);
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
                expect(err.message).toContain(`Invalid String: 'documentContent'`);
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
                expect(result.vault_revision).toEqual(3);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`Invalid String: 'documentName'`);
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
                expect(err.message).toContain(`Unauthorized access to vault contents`);
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

    describe('AddDocumentFromS3', function() {

        const mockedGetObjectSuccessOctet = jest.fn().mockImplementation((params, cb) => {
            cb(null, {Body: "octetdata"});
        });
        const mockedGetObjectSuccessPng = jest.fn().mockImplementation((params, cb) => {
            cb(null, {Body: knownDocumentContentb64, ContentType: "image/png"});
        });
        const mockedGetObjectFail = jest.fn().mockImplementation((params, cb) => {
            cb(new Error("Mocked failure"), null);
        });

        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'key', 'bucket']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates documentName is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: {},
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'documentName'`);
            }
        }));

        it(`Validates key is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: {},
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'key'`);
            }
        }));

        it(`Validates bucket is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'bucket'`);
            }
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    getObject: (params, cb) => {
                        mockedGetObjectSuccessPng(params, cb);
                    }
                };
            });

            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Add fails if s3 object not found`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    getObject: (params, cb) => {
                        mockedGetObjectFail(params, cb);
                    }
                };
            });

            try {
                await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 's3png.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('S3 Read File: File Not Found [Mocked failure]');
            }
        }));

        it(`Adds new png data`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    getObject: (params, cb) => {
                        mockedGetObjectSuccessPng(params, cb);
                    }
                };
            });

            try {
                const result: any = await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 's3png.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(result.vault_revision).toEqual(4);
                expect(fs.existsSync(`./${testableLocalVaultId}/documents/s3png.png.json`)).toBeTruthy();

                const getResult: any = await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 's3png.png',
                });
                expect(getResult.success).toBeTruthy();
                expect(getResult.document).toEqual(knownDocumentContent);
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Adds new octet data`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    getObject: (params, cb) => {
                        mockedGetObjectSuccessOctet(params, cb);
                    }
                };
            });

            try {
                const result: any = await CallRPCMethod(RPCVault.AddDocumentFromS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 's3octet.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(result.vault_revision).toEqual(5);
                expect(fs.existsSync(`./${testableLocalVaultId}/documents/s3octet.png.json`)).toBeTruthy();

                const getResult: any = await CallRPCMethod(RPCVault.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 's3octet.png',
                });
                expect(getResult.success).toBeTruthy();
                expect(getResult.document).toEqual("data:application/octet-stream;base64,octetdata");
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('PutDocumentInS3', function() {

        const mockedUploadSuccess = jest.fn().mockImplementation((params, cb) => {
            cb(null, true);
        });
        const mockedUploadFail = jest.fn().mockImplementation((params, cb) => {
            cb(new Error("Mocked failure"), null);
        });

        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'key', 'bucket']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates documentName is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: {},
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'documentName'`);
            }
        }));

        it(`Validates key is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: {},
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'key'`);
            }
        }));

        it(`Validates bucket is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'bucket'`);
            }
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    upload: (params, cb) => {
                        mockedUploadSuccess(params, cb);
                    }
                };
            });

            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Put fails if document not found`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    upload: (params, cb) => {
                        mockedUploadFail(params, cb);
                    }
                };
            });

            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'none.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Unauthorized access to vault contents');
            }
        }));

        it(`Throws if upload fails`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    upload: (params, cb) => {
                        mockedUploadFail(params, cb);
                    }
                };
            });

            try {
                await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Write File to s3: File Not Found [Mocked failure]');
            }
        }));

        it(`Puts existing png document data`, mochaAsync(async () => {

            AWS.S3 = jest.fn().mockImplementation( ()=> {
                return {
                    upload: (params, cb) => {
                        mockedUploadSuccess(params, cb);
                    }
                };
            });

            try {
                const result: any = await CallRPCMethod(RPCVault.PutDocumentInS3, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    key: 'key',
                    bucket: 'bucket',
                });
                expect(result.success).toBeTruthy();
                expect(mockedUploadSuccess).toHaveBeenCalledWith({
                        Key: 'key',
                        Body: Buffer.from(knownDocumentContentb64, 'base64'),
                        ACL: 'private',
                        Bucket: 'bucket',
                        ContentType: 'image/png',
                    },
                    expect.any(Function));
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                    name: "s3octet.png",
                },{
                    name: "s3png.png",
                },{
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Requires date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [[]]);
        }));

        it(`Requires only date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                    sequence: 1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [['date', 'sequence']]);
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

        it(`Validates Number parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 'not a number',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidNumberParams(caughtError, ['sequence']);
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
                expect(err.message).toContain('StorageCredentials not found');
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
                expect(err.message).toContain('Wallet not found');
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
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
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
                expect(err.message).toContain(`No data found for date`);
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

        it(`Throws when sequence is not for container`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Ledger data at index 1 is not for container shipment`);
            }
        }));

        it(`Returns intermediate data at a sequence for shipment data`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 2,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    shipment: {
                        id: knownShipmentSchemaId,
                        version: '0.0.1',
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns other data at a sequence for shipment data`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalShipmentData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 6,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
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

    describe('GetHistoricalTrackingData', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Requires date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [[]]);
        }));

        it(`Requires only date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                    sequence: 1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [['date', 'sequence']]);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
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
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
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

        it(`Validates Number parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 'not a number',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidNumberParams(caughtError, ['sequence']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when no data exists for date`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                    date: DATE_0,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`No data found for date`);
            }
        }));

        it(`Returns latest data when exists`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    tracking: [{
                        some: 'data'
                    }],
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns intermediate data when exists`, mochaAsync(async () => {
            try {
                // Add new data at DATE_3
                mockDate(DATE_3);
                await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    payload: {
                        more: 'data',
                    },
                });
                resetDate(); // <-- Very important!

                // Check data at DATE_2 is still previous data
                let result: any = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });

                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    tracking: [{
                        some: 'data'
                    }],
                });

                // Check data at DATE_4 is most recent
                result = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_4,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_3,
                    tracking: [{
                        some: 'data',
                    },{
                        more: 'data'
                    }],
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Throws when no data exists for sequence`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 0,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`No data found at specific sequence`);
            }
        }));

        it(`Returns Tracking data up to a sequence 2`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 3,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    tracking: [{
                        'some': 'data',
                    }],
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns Tracking data up to a sequence 3`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 8,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    tracking: [{
                        'some': 'data',
                    },{
                        'more': 'data',
                    }],
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetHistoricalDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Requires date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [[]]);
        }));

        it(`Requires only date or sequence`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                    sequence: 1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidParameterCombinationParams(caughtError, [['date', 'sequence']], [['date', 'sequence']]);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
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
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
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

        it(`Validates Number parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 'not a number',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidNumberParams(caughtError, ['sequence']);
        }));

        it(`Validates documentName is string if provided`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                    documentName: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid String: 'documentName'`);
            }
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: testableLocalVaultId,
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    date: DATE_1,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when no data exists for date`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: emptyLocalVaultId,
                    date: DATE_0,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`No data found for date`);
            }
        }));

        it(`Returns latest data when exists`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    documents: {
                        's3octet.png': 'data:application/octet-stream;base64,octetdata',
                        's3png.png': knownDocumentContent,
                        'test.png': knownDocumentContent,
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
                await CallRPCMethod(RPCVault.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    documentName: 'test.png',
                    documentContent: knownDocumentContent + 'extra',
                });
                resetDate(); // <-- Very important!

                // Check data at DATE_2 is still previous data
                let result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                });

                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    documents: {
                        's3octet.png': 'data:application/octet-stream;base64,octetdata',
                        's3png.png': knownDocumentContent,
                        'test.png': knownDocumentContent,
                    },
                });

                // Check data at DATE_4 is most recent
                result = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_4,
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_3,
                    documents: {
                        's3octet.png': 'data:application/octet-stream;base64,octetdata',
                        's3png.png': knownDocumentContent,
                        'test.png': knownDocumentContent + "extra",
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Returns latest data for specific document when exists`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                    documentName: 'test.png',
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    on_date: DATE_1,
                    documents: {
                        'test.png': knownDocumentContent,
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Throws when no data for specific document exists for date`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    date: DATE_2,
                    documentName: 'none.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`No data found for date`);
            }
        }));

        it(`Throws when sequence is not for container`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 1,
                    documentName: 'none.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Ledger data at index 1 is not for container documents`);
            }
        }));

        it(`Throws when no data for specific document exists for sequence`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 3,
                    documentName: 'none.png',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`No data found at specific sequence`);
            }
        }));

        it(`Returns data at a sequence for specific document when exists`, mochaAsync(async () => {
            try {
                resetDate(); // <-- Very important!
                const result: any = await CallRPCMethod(RPCVault.GetHistoricalDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: testableLocalVaultId,
                    sequence: 3,
                    documentName: 'test.png',
                });
                expect(result.success).toBeTruthy();
                expect(result.historical_data).toEqual({
                    documents: {
                        'test.png': knownDocumentContent,
                    },
                });
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('migrateVault', function() {
        it(`Migrate an old vault upon modification request`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCVault.AddTrackingData, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: dummyId,
                    payload: {
                        some: 'data'
                    },
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(fs.existsSync(`${vaultDir}/tracking/20180101.json`)).toBeTruthy();
                expect(fs.existsSync(`${vaultDir}/meta.json`)).toBeTruthy();
                const meta = JSON.parse(fs.readFileSync(`${vaultDir}/meta.json`));
                expect(meta.version == newVersion).toBeTruthy();
                expect(typeof meta.containers.tracking == "string").toBeTruthy();
                expect(typeof meta.containers.ledger == "string").toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

};
