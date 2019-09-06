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
    CallRPCMethod, expectInvalidNumberParams
} from "../utils";

import { buildSchemaValidators } from "../../validators";
import { RPCShipChainVault } from '../../shipchain_vault';
import { RPCShipment } from '../../primitives/shipment';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCShipmentPrimitiveTests = async function() {
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
    let itemId;

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
        itemId = uuidv4();

    });

    beforeEach(async () => {
        mockDate(DATE_1);

        const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
            storageCredentials: localStorage.id,
            vaultWallet: fullWallet1.id,
            additionalWallet: fullWallet2.id,
            primitives: ["Shipment"],
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
                await CallRPCMethod(RPCShipment.Get, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.Get, {
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
                await CallRPCMethod(RPCShipment.Get, {
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
                await CallRPCMethod(RPCShipment.Get, {
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
                await CallRPCMethod(RPCShipment.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Gets empty Shipment data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipment.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.shipment).toBeDefined();
                expect(result.shipment.fields).toEqual({});
                expect(result.shipment.documents).toEqual({});
                expect(result.shipment.tracking).toBeNull();
                expect(result.shipment.items).toEqual({});
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetFields', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetFields, {
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
                await CallRPCMethod(RPCShipment.GetFields, {
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
                await CallRPCMethod(RPCShipment.GetFields, {
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
                await CallRPCMethod(RPCShipment.GetFields, {
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
                const result: any = await CallRPCMethod(RPCShipment.GetFields, {
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
                await CallRPCMethod(RPCShipment.SetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'fields']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    fields: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    fields: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    fields: {id: uuidv4(), version: '0.0.1'},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates fields is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: 'a string',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid Object: 'fields'`);
            }

            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: [],
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Invalid Object: 'fields'`);
            }
        }));

        it(`Validates Shipment matches schema`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {
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

        it(`Sets Shipment fields`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipment.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {id: getPrimitiveData('Shipment').fields.id, version: '0.0.1'},
                });

                expect(result.success).toBeTruthy();

                const response: any = await CallRPCMethod(RPCShipment.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.fields).toBeDefined();
                expect(response.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(response.fields.version).toEqual('0.0.1');

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Document '${localStorage.id}' not found in Shipment`);
            }
        }));

        it(`Gets Document when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Shipment');
                await itemPrimitive.addDocument(fullWallet1, documentId, getNockableLink('Document'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId', 'documentLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                await CallRPCMethod(RPCShipment.AddDocument, {
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
                const result: any = await CallRPCMethod(RPCShipment.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCShipment.GetDocument, {
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
                await CallRPCMethod(RPCShipment.ListDocuments, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.ListDocuments, {
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
                await CallRPCMethod(RPCShipment.ListDocuments, {
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
                await CallRPCMethod(RPCShipment.ListDocuments, {
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
                await CallRPCMethod(RPCShipment.ListDocuments, {
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
                let result: any = await CallRPCMethod(RPCShipment.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([]);

                result = await CallRPCMethod(RPCShipment.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCShipment.ListDocuments, {
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

    describe('GetTracking', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetTracking, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetTracking, {
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
                await CallRPCMethod(RPCShipment.GetTracking, {
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
                await CallRPCMethod(RPCShipment.GetTracking, {
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
                await CallRPCMethod(RPCShipment.GetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Tracking when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.GetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Tracking not found in Shipment`);
            }
        }));

        it(`Gets Tracking when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Shipment');
                await itemPrimitive.setTracking(fullWallet1, getNockableLink('Tracking'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Tracking');

                const response: any = await CallRPCMethod(RPCShipment.GetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.tracking).toBeDefined();
                expect(response.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);

                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('SetTracking', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.SetTracking, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'trackingLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    trackingLink: getNockableLink('Tracking'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    trackingLink: getNockableLink('Tracking'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    trackingLink: getNockableLink('Tracking'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    trackingLink: getNockableLink('Tracking'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates trackingLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    trackingLink: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['trackingLink']);
            }
        }));

        it(`Validates trackingLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    trackingLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Tracking] instead received [Shipment]`);
            }
        }));

        it(`Sets Tracking Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipment.SetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    trackingLink: getNockableLink('Tracking'),
                });

                expect(result.success).toBeTruthy();

                const thisTrackingNock = nockLinkedData('Tracking');

                const response: any = await CallRPCMethod(RPCShipment.GetTracking, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.tracking).toBeDefined();
                expect(response.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);

                expect(thisTrackingNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetItem', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetItem, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'itemId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    itemId: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'itemId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    itemId: itemId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    itemId: itemId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Item when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Item '${localStorage.id}' not found in Shipment`);
            }
        }));

        it(`Gets Item when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Shipment');
                await itemPrimitive.addItem(fullWallet1, itemId, getNockableLink('Item'));
                await vault2.writeMetadata(fullWallet1);

                const thisItemNock = nockLinkedData('Item');
                const thisDocumentNock = nockLinkedData('Document');
                const thisProductNock = nockLinkedData('Product');

                const response: any = await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.item).toBeDefined();
                expect(response.item.quantity).toEqual(1);
                expect(response.item.item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(response.item.item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.item.item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisItemNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddItem', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.AddItem, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'itemId', 'itemLink', 'quantity']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    itemId: '123',
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'itemId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates itemLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: {},
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['itemLink']);
            }
        }));

        it(`Validates itemLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Shipment'),
                    quantity: 2,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Item] instead received [Shipment]`);
            }
        }));

        it(`Validates quantity is numeric`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 'two',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidNumberParams(err, ['quantity']);
            }
        }));

        it(`Adds Item Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });

                expect(result.success).toBeTruthy();

                const thisItemNock = nockLinkedData('Item');
                const thisDocumentNock = nockLinkedData('Document');
                const thisProductNock = nockLinkedData('Product');

                const response: any = await CallRPCMethod(RPCShipment.GetItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.item).toBeDefined();
                expect(response.item.quantity).toEqual(2);
                expect(response.item.item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(response.item.item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.item.item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisItemNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('ListItems', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.ListItems, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipment.ListItems, {
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
                await CallRPCMethod(RPCShipment.ListItems, {
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
                await CallRPCMethod(RPCShipment.ListItems, {
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
                await CallRPCMethod(RPCShipment.ListItems, {
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
                let result: any = await CallRPCMethod(RPCShipment.ListItems, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.items).toEqual([]);

                result = await CallRPCMethod(RPCShipment.AddItem, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    itemId: itemId,
                    itemLink: getNockableLink('Item'),
                    quantity: 2,
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCShipment.ListItems, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.items).toEqual([itemId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

};
