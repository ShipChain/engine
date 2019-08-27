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
import { RPCProcurement } from '../../primitives/procurement';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCProcurementPrimitiveTests = async function() {
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
    let shipmentId;
    let documentId;
    let productId;

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

        shipmentId = uuidv4();
        documentId = uuidv4();
        productId = uuidv4();

    });

    beforeEach(async () => {
        mockDate(DATE_1);

        const result: any = await CallRPCMethod(RPCShipChainVault.Create, {
            storageCredentials: localStorage.id,
            shipperWallet: fullWallet1.id,
            carrierWallet: fullWallet2.id,
            primitives: ["Procurement"],
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
                await CallRPCMethod(RPCProcurement.Get, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.Get, {
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
                await CallRPCMethod(RPCProcurement.Get, {
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
                await CallRPCMethod(RPCProcurement.Get, {
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
                await CallRPCMethod(RPCProcurement.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Gets empty Procurement data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProcurement.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.procurement).toBeDefined();
                expect(result.procurement.fields).toEqual({});
                expect(result.procurement.shipments).toEqual({});
                expect(result.procurement.documents).toEqual({});
                expect(result.procurement.products).toEqual({});
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetFields', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetFields, {
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
                await CallRPCMethod(RPCProcurement.GetFields, {
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
                await CallRPCMethod(RPCProcurement.GetFields, {
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
                await CallRPCMethod(RPCProcurement.GetFields, {
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
                const result: any = await CallRPCMethod(RPCProcurement.GetFields, {
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
                await CallRPCMethod(RPCProcurement.SetFields, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'fields']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.SetFields, {
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
                await CallRPCMethod(RPCProcurement.SetFields, {
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
                await CallRPCMethod(RPCProcurement.SetFields, {
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
                await CallRPCMethod(RPCProcurement.SetFields, {
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

        it(`Validates fields is object`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.SetFields, {
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
                await CallRPCMethod(RPCProcurement.SetFields, {
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

        it(`Sets Procurement fields`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProcurement.SetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    fields: {name: 'procurement name'},
                });

                expect(result.success).toBeTruthy();

                const response: any = await CallRPCMethod(RPCProcurement.GetFields, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.fields).toBeDefined();
                expect(response.fields.name).toEqual('procurement name');

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('GetShipment', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    shipmentId: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    shipmentId: shipmentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    shipmentId: shipmentId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Shipment when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Shipment '${localStorage.id}' not found in Procurement`);
            }
        }));

        it(`Gets Shipment when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Procurement');
                await itemPrimitive.addShipment(fullWallet1, shipmentId, getNockableLink('Shipment'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document', 2);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product');
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');

                const response: any = await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.shipment).toBeDefined();
                expect(response.shipment.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(response.shipment.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.shipment.items['itemId'].quantity).toEqual(1);
                expect(response.shipment.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(response.shipment.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.shipment.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.shipment.tracking.length).toEqual(getPrimitiveData('Tracking').length);
                expect(response.shipment.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);


                expect(thisShipmentNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisItemNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
                expect(thisTrackingNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddShipment', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'shipmentId', 'shipmentLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates shipmentLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: {},
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['shipmentLink']);
            }
        }));

        it(`Validates shipmentLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Document'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Shipment] instead received [Document]`);
            }
        }));

        it(`Adds Shipment Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document', 2);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product');
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');

                const response: any = await CallRPCMethod(RPCProcurement.GetShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.shipment).toBeDefined();
                expect(response.shipment.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(response.shipment.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.shipment.items['itemId'].quantity).toEqual(1);
                expect(response.shipment.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(response.shipment.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.shipment.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.shipment.tracking.length).toEqual(getPrimitiveData('Tracking').length);
                expect(response.shipment.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);


                expect(thisShipmentNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisItemNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
                expect(thisTrackingNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('ListShipments', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.ListShipments, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.ListShipments, {
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
                await CallRPCMethod(RPCProcurement.ListShipments, {
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
                await CallRPCMethod(RPCProcurement.ListShipments, {
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
                await CallRPCMethod(RPCProcurement.ListShipments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Lists Shipments`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCProcurement.ListShipments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.shipments).toEqual([]);

                result = await CallRPCMethod(RPCProcurement.AddShipment, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    shipmentId: shipmentId,
                    shipmentLink: getNockableLink('Shipment'),
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCProcurement.ListShipments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.shipments).toEqual([shipmentId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

    describe('GetDocument', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.GetDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Document '${localStorage.id}' not found in Procurement`);
            }
        }));

        it(`Gets Document when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Procurement');
                await itemPrimitive.addDocument(fullWallet1, documentId, getNockableLink('Document'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'documentId', 'documentLink']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                await CallRPCMethod(RPCProcurement.AddDocument, {
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
                const result: any = await CallRPCMethod(RPCProcurement.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCProcurement.GetDocument, {
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
                await CallRPCMethod(RPCProcurement.ListDocuments, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.ListDocuments, {
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
                await CallRPCMethod(RPCProcurement.ListDocuments, {
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
                await CallRPCMethod(RPCProcurement.ListDocuments, {
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
                await CallRPCMethod(RPCProcurement.ListDocuments, {
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
                let result: any = await CallRPCMethod(RPCProcurement.ListDocuments, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.documents).toEqual([]);

                result = await CallRPCMethod(RPCProcurement.AddDocument, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    documentId: documentId,
                    documentLink: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCProcurement.ListDocuments, {
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

    describe('GetProduct', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'productId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    productId: '123',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'productId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    productId: productId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    productId: productId,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when retrieving Product when not set`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: localStorage.id,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Product '${localStorage.id}' not found in Procurement`);
            }
        }));

        it(`Gets Product when set`, mochaAsync(async () => {
            try {
                let vault2 = new ShipChainVault(await localStorage.getDriverOptions(), vaultId);
                await vault2.loadMetadata();
                let itemPrimitive = vault2.getPrimitive('Procurement');
                await itemPrimitive.addProduct(fullWallet1, productId, getNockableLink('Product'));
                await vault2.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document');
                const thisProductNock = nockLinkedData('Product');

                const response: any = await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.product).toBeDefined();
                expect(response.product.quantity).toEqual(1);
                expect(response.product.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.product.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('AddProduct', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'productId', 'productLink', 'quantity']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    productId: '123',
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'productId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates productLink is string`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: {},
                    quantity: 2,
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidStringParams(err, ['productLink']);
            }
        }));

        it(`Validates productLink is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Shipment'),
                    quantity: 2,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Product] instead received [Shipment]`);
            }
        }));

        it(`Validates quantity is numeric`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 'two',
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expectInvalidNumberParams(err, ['quantity']);
            }
        }));

        it(`Adds Product Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document');
                const thisProductNock = nockLinkedData('Product');

                const response: any = await CallRPCMethod(RPCProcurement.GetProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.product).toBeDefined();
                expect(response.product.quantity).toEqual(2);
                expect(response.product.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.product.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('ListProducts', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.ListProducts, {});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurement.ListProducts, {
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
                await CallRPCMethod(RPCProcurement.ListProducts, {
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
                await CallRPCMethod(RPCProcurement.ListProducts, {
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
                await CallRPCMethod(RPCProcurement.ListProducts, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw"); return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Lists Products`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCProcurement.ListProducts, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.products).toEqual([]);

                result = await CallRPCMethod(RPCProcurement.AddProduct, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    productId: productId,
                    productLink: getNockableLink('Product'),
                    quantity: 2,
                });

                expect(result.success).toBeTruthy();

                result = await CallRPCMethod(RPCProcurement.ListProducts, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.products).toEqual([productId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));

    });

};
