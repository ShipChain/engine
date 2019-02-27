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
    CallRPCMethod,
} from "./utils";

import { RPCVault } from '../vault';
import { uuidv4 } from "../../src/utils";
import { StorageCredential } from "../../src/entity/StorageCredential";
import { Wallet } from "../../src/entity/Wallet";
import { PrivateKeyDBFieldEncryption } from "../../src/entity/encryption/PrivateKeyDBFieldEncryption";

export const RPCVaultTests = async function() {

    let fullWallet1;
    let fullWallet2;
    let localStorage;

    let testableVaultId;

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

        it(`Returns new Vault`, mochaAsync(async () => {
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

                // Save this vault_id for use in later tests
                testableVaultId = result.vault_id;
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
