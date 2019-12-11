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
    CallRPCMethod, expectInvalidStringParams
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

        it(`Validates vaultUri is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVaultNotary.RegisterVaultTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultUri: {},
                    vaultHash: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['vaultUri']);
            }
        }));

        it(`Validates vaultHash is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCVaultNotary.RegisterVaultTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultUri: '123',
                    vaultHash: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['vaultHash']);
            }
        }));


    });

    //Test for Uri related endpoints start from here
    describe('SetVaultUri', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.SetVaultUriTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'vaultUri']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.SetVaultUriTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    vaultUri: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.SetVaultUriTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultUri: '123',
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
        }));

        it(`Validates vaultUri is string`, mochaAsync(async () => {
            try {
                 await CallRPCMethod(RPCVaultNotary.SetVaultUriTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultUri: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['vaultUri']);
            }
        }));


    });

    describe('GrantUpdateUriPermission', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.GrantUpdateUriPermissionTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'toGrantWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.GrantUpdateUriPermissionTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    toGrantWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet', 'toGrantWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.GrantUpdateUriPermissionTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    toGrantWallet: fullWallet2.id,
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
        }));

    });

    describe('RevokeUpdateUriPermission', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RevokeUpdateUriPermissionTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'toRevokeWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RevokeUpdateUriPermissionTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    toRevokeWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet', 'toRevokeWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.RevokeUpdateUriPermissionTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    toRevokeWallet: fullWallet2.id,
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
        }));

    });

    //Test for Hash related endpoints start from here
    describe('SetVaultHash', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.SetVaultHashTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'vaultHash']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.SetVaultHashTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    vaultHash: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.SetVaultHashTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultHash: '123',
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
        }));

        it(`Validates vaultHash is string`, mochaAsync(async () => {
            try {
                 await CallRPCMethod(RPCVaultNotary.SetVaultHashTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    vaultHash: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['vaultHash']);
            }
        }));

    });

    describe('GrantUpdateHashPermission', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.GrantUpdateHashPermissionTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'toGrantWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.GrantUpdateHashPermissionTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    toGrantWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet', 'toGrantWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.GrantUpdateHashPermissionTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    toGrantWallet: fullWallet2.id,
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
        }));

    });

    describe('RevokeUpdateHashPermission', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RevokeUpdateHashPermissionTx, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['vaultId', 'senderWallet', 'toRevokeWallet']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCVaultNotary.RevokeUpdateHashPermissionTx, {
                    senderWallet: '123',
                    vaultId: '123',
                    toRevokeWallet: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['vaultId', 'senderWallet', 'toRevokeWallet']);
        }));


        it(`Validate properties exist in the build transaction return`, mochaAsync(async () => {
                let rpcReturn = await CallRPCMethod(RPCVaultNotary.RevokeUpdateHashPermissionTx, {
                    vaultId: uuidv4(),
                    senderWallet: fullWallet1.id,
                    toRevokeWallet: fullWallet2.id,
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
        }));

    })

};
