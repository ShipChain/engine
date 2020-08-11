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
const AWS = require('aws-sdk');
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    cleanupEntities,
    CallRPCMethod, expectInvalidStringArrayParams
} from "./utils";

import { buildSchemaValidators } from "../validators";
import { RPCShipChainVault } from '../shipchain_vault';
import { uuidv4 } from "../../src/utils";
import { StorageCredential } from "../../src/entity/StorageCredential";
import { Wallet } from "../../src/entity/Wallet";
import { EncryptorContainer } from '../../src/entity/encryption/EncryptorContainer';
import { ShipChainVault } from "../../src/shipchain/vaults/ShipChainVault";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCShipChainVaultTests = function() {
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

    async function getEmptyVaultId() {
        const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
            storageCredentials: localStorage.id,
            vaultWallet: fullWallet1.id,
            additionalWallet: fullWallet2.id,
        });
        return result.vault_id;
    }

    describe('CreateVault', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipChainVault.Create, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    additionalWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'additionalWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    additionalWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'additionalWallet']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Carrier exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Creates new Vault`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
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
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('CreateVault with Primitives', function() {

        it(`Validates optional Primitives is an Array`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                    primitives: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives is a non-empty if provided`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                    primitives: [],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives is an Array of Strings`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                    primitives: ["one", 2],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives contains valid Primitives`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                    primitives: ["UnknownPrimitive"],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid request [Error: Primitive type is not valid [UnknownPrimitive]]`);
            }
        }));

        it(`Creates new Vault`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    additionalWallet: fullWallet2.id,
                    primitives: ["Shipment"],
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
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('InjectPrimitives', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'primitives']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    primitives: ['Shipment'],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: ["Shipment"],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Vault Wallet exists`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    primitives: ["Shipment"],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    primitives: ["Shipment"],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates optional Primitives is an Array`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives is a non-empty if provided`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: [],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives is an Array of Strings`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: ["one", 2],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringArrayParams(err, ['primitives']);
            }
        }));

        it(`Validates optional Primitives contains valid Primitives`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: ["UnknownPrimitive"],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid request [Error: Primitive type is not valid [UnknownPrimitive]]`);
            }
        }));

        it(`Injects Primitive`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                const result: any = await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: ["Shipment"],
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(result.vault_revision).toEqual(1);

                const storage = await StorageCredential.getOptionsById(localStorage.id);
                const vault = new ShipChainVault(storage, vaultId);
                await vault.loadMetadata();
                expect(vault.hasPrimitive('Shipment')).toBeTruthy();

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

        it(`Throws when Injecting a duplicate Primitive`, mochaAsync(async () => {
            try {
                let vaultId = await getEmptyVaultId();
                const result: any = await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    primitives: ["Shipment"],
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_signed).toBeDefined();
                expect(result.vault_revision).toEqual(1);

                try {
                    await CallRPCMethod(RPCShipChainVault.InjectPrimitives, {
                        storageCredentials: localStorage.id,
                        vaultWallet: fullWallet1.id,
                        vault: vaultId,
                        primitives: ["Shipment"],
                    });
                    fail("Did not Throw"); return;
                } catch (err) {
                    expect(err.message).toEqual(`Invalid request [Error: Primitive Shipment already exists in Vault ${vaultId}]`);
                }
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

};
