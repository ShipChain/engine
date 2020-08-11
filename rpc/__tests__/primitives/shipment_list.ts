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
import { RPCShipmentList } from '../../primitives/shipment_list';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";
import { RemoteVault } from "../../../src/vaults/RemoteVault";
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCShipmentListPrimitiveTests = function() {
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
            primitives: ["ShipmentList"],
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
                await CallRPCMethod(RPCShipmentList.Get, {});
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
                await CallRPCMethod(RPCShipmentList.Get, {
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
                await CallRPCMethod(RPCShipmentList.Get, {
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
                await CallRPCMethod(RPCShipmentList.Get, {
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
                await CallRPCMethod(RPCShipmentList.Get, {
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
                await CallRPCMethod(RPCShipmentList.Get, {
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

        it(`Gets valid Shipment data`, mochaAsync(async () => {
            try {
                const storage = await StorageCredential.getOptionsById(localStorage.id);
                const vault = new ShipChainVault(storage, vaultId);
                await vault.loadMetadata();
                vault.getPrimitive('ShipmentList').addEntity(fullWallet1, linkId, RemoteVault.buildLinkEntry(getNockableLink('Shipment')));
                await vault.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document', 2);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product');
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');


                const result: any = await CallRPCMethod(RPCShipmentList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);

                expect(result.shipment.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
                expect(result.shipment.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(result.shipment.items['itemId'].quantity).toEqual(1);
                expect(result.shipment.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
                expect(result.shipment.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
                expect(result.shipment.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
                expect(result.shipment.tracking.length).toEqual(getPrimitiveData('Tracking').length);
                expect(result.shipment.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);


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
                await CallRPCMethod(RPCShipmentList.Add, {});
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
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    linkId: '123',
                    linkEntry: getNockableLink('Shipment'),
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
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates if linkEntry is string it can be parsed`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipmentList.Add, {
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
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: RemoteVault.buildLinkEntry(getNockableLink('Item')),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Shipment] instead received [Item]`);
            }
        }));

        it(`Validates if linkEntry object is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Item'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Shipment] instead received [Item]`);
            }
        }));

        it(`Adds Shipment Link`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document', 2);
                const thisItemNock = nockLinkedData('Item');
                const thisProductNock = nockLinkedData('Product');
                const thisTrackingNock = nockLinkedData('Tracking');
                const thisShipmentNock = nockLinkedData('Shipment');


                const response: any = await CallRPCMethod(RPCShipmentList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);

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

    describe('Count', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCShipmentList.Count, {});
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
                await CallRPCMethod(RPCShipmentList.Count, {
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
                await CallRPCMethod(RPCShipmentList.Count, {
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
                await CallRPCMethod(RPCShipmentList.Count, {
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
                await CallRPCMethod(RPCShipmentList.Count, {
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

        it(`Counts Shipments in List`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCShipmentList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.count).toEqual(0);

                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });

                result = await CallRPCMethod(RPCShipmentList.Count, {
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
                await CallRPCMethod(RPCShipmentList.List, {});
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
                await CallRPCMethod(RPCShipmentList.List, {
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
                await CallRPCMethod(RPCShipmentList.List, {
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
                await CallRPCMethod(RPCShipmentList.List, {
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
                await CallRPCMethod(RPCShipmentList.List, {
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

        it(`Lists Shipments`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCShipmentList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.shipment_list).toEqual([]);

                await CallRPCMethod(RPCShipmentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Shipment'),
                });

                result = await CallRPCMethod(RPCShipmentList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.shipment_list).toEqual([linkId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
