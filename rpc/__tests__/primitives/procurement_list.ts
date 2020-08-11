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




import { ProcurementProperties } from "../../../src/shipchain/vaults/primitives/Procurement";

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
import { RPCProcurementList } from '../../primitives/procurement_list';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";
import { RemoteVault } from "../../../src/vaults/RemoteVault";
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCProcurementListPrimitiveTests = function() {
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
    let linkId;

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
            vaultWallet: fullWallet1.id,
            additionalWallet: fullWallet2.id,
            primitives: ["ProcurementList"],
        });
        vaultId = result.vault_id;
        linkId = uuidv4();
    });

    afterEach(async () => {
        resetDate();
    });


    afterAll(async () => {
        await cleanupEntities(typeorm);
    });

    describe('Get', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Get, {});
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'linkId']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    linkId: '123',
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'linkId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    linkId: linkId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    linkId: linkId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Throws when unknown linkId`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: localStorage.id,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toEqual(`Invalid request [Error: LinkID [${localStorage.id}] not found!]`);
            }
        }));

        it(`Gets valid Procurement data`, mochaAsync(async () => {
            try {
                const storage = await StorageCredential.getOptionsById(localStorage.id);
                const vault = new ShipChainVault(storage, vaultId);
                await vault.loadMetadata();
                vault.getPrimitive('ProcurementList').addEntity(fullWallet1, linkId, RemoteVault.buildLinkEntry(getNockableLink('Procurement')));
                await vault.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document', 4);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product', 2);
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');
                const thisProcurementNock = nockLinkedData('Procurement');

                const result: any = await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.procurement).toBeDefined();
                expect(result.procurement.fields.name).toEqual(getPrimitiveData('Procurement').fields.name);
                expect(result.procurement.shipments['shipmentId'].fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(result.procurement.shipments['shipmentId'].documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(result.procurement.shipments['shipmentId'].items['itemId'].quantity).toEqual(1);
                expect(result.procurement.shipments['shipmentId'].items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(result.procurement.shipments['shipmentId'].items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(result.procurement.shipments['shipmentId'].items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(result.procurement.shipments['shipmentId'].tracking.length).toEqual(getPrimitiveData('Tracking').length);
                expect(result.procurement.shipments['shipmentId'].tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);
                expect(result.procurement.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(result.procurement.products['productId'].quantity).toEqual(1);
                expect(result.procurement.products['productId'].product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(result.procurement.products['productId'].product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisProcurementNock.isDone()).toBeTruthy();
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

    describe('Add', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Add, {});
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'linkId', 'linkEntry']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    linkId: '123',
                    linkEntry: getNockableLink('Procurement'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault', 'linkId']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates if linkEntry is string it can be parsed`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: 'not a link entry string',
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Invalid LinkEntry provided`);
            }
        }));

        it(`Validates if linkEntry object is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: RemoteVault.buildLinkEntry(getNockableLink('Item')),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Procurement] instead received [Item]`);
            }
        }));

        it(`Validates if linkEntry object is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Item'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Procurement] instead received [Item]`);
            }
        }));

        it(`Adds Procurement Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document', 4);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product', 2);
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');
                const thisProcurementNock = nockLinkedData('Procurement');

                const response: any = await CallRPCMethod(RPCProcurementList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.procurement).toBeDefined();
                expect(response.procurement.fields.name).toEqual(getPrimitiveData('Procurement').fields.name);
                expect(response.procurement.shipments['shipmentId'].fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(response.procurement.shipments['shipmentId'].documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.procurement.shipments['shipmentId'].items['itemId'].quantity).toEqual(1);
                expect(response.procurement.shipments['shipmentId'].items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(response.procurement.shipments['shipmentId'].items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.procurement.shipments['shipmentId'].items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.procurement.shipments['shipmentId'].tracking.length).toEqual(getPrimitiveData('Tracking').length);
                expect(response.procurement.shipments['shipmentId'].tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);
                expect(response.procurement.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(response.procurement.products['productId'].quantity).toEqual(1);
                expect(response.procurement.products['productId'].product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(response.procurement.products['productId'].product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisProcurementNock.isDone()).toBeTruthy();
                expect(thisShipmentNock.isDone()).toBeTruthy();
                expect(thisDocumentNock.isDone()).toBeTruthy();
                expect(thisItemNock.isDone()).toBeTruthy();
                expect(thisProductNock.isDone()).toBeTruthy();
                expect(thisTrackingNock.isDone()).toBeTruthy();

                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('Count', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Count, {});
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Counts Procurements in List`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.count).toEqual(0);

                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });

                result = await CallRPCMethod(RPCProcurementList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.count).toEqual(1);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('List', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.List, {});
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates UUID parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                caughtError = err;
            }

            expectInvalidUUIDParams(caughtError, ['storageCredentials', 'vaultWallet', 'vault']);
        }));

        it(`Validates StorageCredentials exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Lists Procurements`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.procurement_list).toEqual([]);

                await CallRPCMethod(RPCProcurementList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Procurement'),
                });

                result = await CallRPCMethod(RPCProcurementList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.procurement_list).toEqual([linkId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
