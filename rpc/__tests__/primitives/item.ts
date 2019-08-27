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





require('../../../src/__tests__/testLoggingConfig');

import 'mocha';
import * as typeorm from "typeorm";
import {
    mochaAsync,
    expectMissingRequiredParams,
    expectInvalidUUIDParams,
    expectInvalidObjectParams,
    expectInvalidStringParams,
    cleanupEntities,
    CallRPCMethod
} from "../utils";

import { buildSchemaValidators } from "../../validators";
import { RPCShipChainVault } from '../../shipchain_vault';
import { RPCItem } from '../../primitives/item';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCItemPrimitiveTests = async function() {
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
    let vaultId;

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

        const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
            storageCredentials: localStorage.id,
            shipperWallet: fullWallet1.id,
            carrierWallet: fullWallet2.id,
            primitives: ["Item"],
        });
        vaultId = result.vault_id;
    });

    afterEach(async () => {
        resetDate();
    });


    afterAll(async() => {
        await cleanupEntities(typeorm);
    });

    describe('Get', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.Get, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.Get, {
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
                await CallRPCMethod(RPCItem.Get, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Gets empty Item data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCItem.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.item).toBeDefined();
                expect(result.item.fields).toEqual({});
                expect(result.item.product).toBeNull();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetFields', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.GetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.GetFields, {
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
                await CallRPCMethod(RPCItem.GetFields, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Gets empty Field data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCItem.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.fields).toBeDefined();
                expect(result.fields).toEqual({});
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('SetFields', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.SetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'fields']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    fields: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    fields: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    fields: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates fields is an object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: '',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidObjectParams(err, ['fields']);
            }
        }));

        it(`Sets Item fields`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCItem.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {
                        serial_number: "item serial #",
                    },
                });

                expect(result.success).toBeTruthy();

                const response: any = await CallRPCMethod(RPCItem.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.fields).toBeDefined();
                expect(response.fields.serial_number).toEqual('item serial #');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetProduct', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.GetProduct, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.GetProduct, {
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
                await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Item Product when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Product not found in Item`);
            }
        }));

        it(`Gets Item Product when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Item');
                await itemPrimitive.setProduct(fullWallet1, getNockableLink('Product'));
                await vault2.writeMetadata(fullWallet1);

                const thisProductNock = nockLinkedData('Product');
                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.product).toBeDefined();
                expect(response.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisProductNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('SetProduct', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.SetProduct, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'productLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    productLink: getNockableLink('Product'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productLink: getNockableLink('Product'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    productLink: getNockableLink('Product'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    productLink: getNockableLink('Product'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates productLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productLink: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['productLink']);
            }
        }));

        it(`Validates productLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Product] instead received [Shipment]`);
            }
        }));

        it(`Sets Product Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCItem.SetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productLink: getNockableLink('Product'),
                });

                expect(result.success).toBeTruthy();

                const thisProductNock = nockLinkedData('Product');
                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCItem.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.product).toBeDefined();
                expect(response.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisProductNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });
};
