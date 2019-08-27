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
import { RPCProduct } from '../../primitives/product';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCProductPrimitiveTests = async function() {
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
    let documentId;

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

        documentId = uuidv4();

    });

    beforeEach(async () => {
        mockDate(DATE_1);

        const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
            storageCredentials: localStorage.id,
            shipperWallet: fullWallet1.id,
            carrierWallet: fullWallet2.id,
            primitives: ["Product"],
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
                await CallRPCMethod(RPCProduct.Get, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.Get, {
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
                await CallRPCMethod(RPCProduct.Get, {
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
                await CallRPCMethod(RPCProduct.Get, {
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
                await CallRPCMethod(RPCProduct.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Gets empty Product data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProduct.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.product).toBeDefined();
                expect(result.product.fields).toEqual({});
                expect(result.product.documents).toEqual({});
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetFields', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.GetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.GetFields, {
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
                await CallRPCMethod(RPCProduct.GetFields, {
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
                await CallRPCMethod(RPCProduct.GetFields, {
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
                await CallRPCMethod(RPCProduct.GetFields, {
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
                const result: any = await CallRPCMethod(RPCProduct.GetFields, {
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
                await CallRPCMethod(RPCProduct.SetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'fields']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.SetFields, {
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
                await CallRPCMethod(RPCProduct.SetFields, {
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
                await CallRPCMethod(RPCProduct.SetFields, {
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
                await CallRPCMethod(RPCProduct.SetFields, {
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
                await CallRPCMethod(RPCProduct.SetFields, {
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

        it(`Sets Product fields`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProduct.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {
                        name: "product name",
                    },
                });

                expect(result.success).toBeTruthy();

                const response: any = await CallRPCMethod(RPCProduct.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.fields).toBeDefined();
                expect(response.fields.name).toEqual('product name');
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.GetDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentId: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    documentId: documentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentId: documentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Document when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Document '${localStorage.id}' not found in Product`);
            }
        }));

        it(`Gets Document when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Product');
                await itemPrimitive.addDocument(fullWallet1, documentId, getNockableLink('Document'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.document).toBeDefined();
                expect(response.document.fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.AddDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId', 'documentLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates documentLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['documentLink']);
            }
        }));

        it(`Validates documentLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Document] instead received [Shipment]`);
            }
        }));

        it(`Adds Document Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCProduct.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                });
                
                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.document).toBeDefined();
                expect(response.document.fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('ListDocuments', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.ListDocuments, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProduct.ListDocuments, {
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
                await CallRPCMethod(RPCProduct.ListDocuments, {
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
                await CallRPCMethod(RPCProduct.ListDocuments, {
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
                await CallRPCMethod(RPCProduct.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Lists Documents`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCProduct.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([]);

                result = await CallRPCMethod(RPCProduct.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCProduct.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([documentId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

};
