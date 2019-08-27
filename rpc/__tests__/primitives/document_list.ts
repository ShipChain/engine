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
import { RPCDocumentList } from '../../primitives/document_list';
import { uuidv4 } from "../../../src/utils";
import { StorageCredential } from "../../../src/entity/StorageCredential";
import { Wallet } from "../../../src/entity/Wallet";
import { EncryptorContainer } from '../../../src/entity/encryption/EncryptorContainer';
import { ShipChainVault } from "../../../src/shipchain/vaults/ShipChainVault";
import { RemoteVault } from "../../../src/vaults/RemoteVault";
import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const DATE_1 = '2018-01-01T01:00:00.000Z';

export const RPCDocumentListPrimitiveTests = async function() {
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
            shipperWallet: fullWallet1.id,
            carrierWallet: fullWallet2.id,
            primitives: ["DocumentList"],
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
                await CallRPCMethod(RPCDocumentList.Get, {});
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
                await CallRPCMethod(RPCDocumentList.Get, {
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
                await CallRPCMethod(RPCDocumentList.Get, {
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
                await CallRPCMethod(RPCDocumentList.Get, {
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
                await CallRPCMethod(RPCDocumentList.Get, {
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
                await CallRPCMethod(RPCDocumentList.Get, {
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

        it(`Gets valid Document data`, mochaAsync(async () => {
            try {
                const storage = await StorageCredential.getOptionsById(localStorage.id);
                const vault = new ShipChainVault(storage, vaultId);
                await vault.loadMetadata();
                vault.getPrimitive('DocumentList').addEntity(fullWallet1, linkId, RemoteVault.buildLinkEntry(getNockableLink('Document')));
                await vault.writeMetadata(fullWallet1);

                const thisDocumentNock = nockLinkedData('Document');

                const result: any = await CallRPCMethod(RPCDocumentList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(result.success).toBeTruthy();
                expect(result.vault_id).toEqual(vaultId);
                expect(result.wallet_id).toEqual(fullWallet1.id);
                expect(result.document).toBeDefined();
                expect(result.document.content).toEqual(getPrimitiveData('Document').content);
                expect(result.document.fields.name).toEqual(getPrimitiveData('Document').fields.name);

                expect(thisDocumentNock.isDone()).toBeTruthy();
            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

    describe('Add', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCDocumentList.Add, {});
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
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: '123',
                    vaultWallet: '123',
                    vault: '123',
                    linkId: '123',
                    linkEntry: getNockableLink('Document'),
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
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: uuidv4(),
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('StorageCredentials not found');
            }
        }));

        it(`Validates Shipper exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: uuidv4(),
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain('Wallet not found');
            }
        }));

        it(`Validates Vault exists`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: uuidv4(),
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Unable to load vault from Storage driver 'File Not Found'`);
            }
        }));

        it(`Validates if linkEntry is string it can be parsed`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCDocumentList.Add, {
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
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: RemoteVault.buildLinkEntry(getNockableLink('Item')),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Document] instead received [Item]`);
            }
        }));

        it(`Validates if linkEntry object is for correct Primitive`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Item'),
                });
                fail("Did not Throw");
                return;
            } catch (err) {
                expect(err.message).toContain(`Expecting Link to [Document] instead received [Item]`);
            }
        }));

        it(`Sets Document data`, mochaAsync(async () => {
            try {
                const result: any = await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });

                expect(result.success).toBeTruthy();

                const thisDocumentNock = nockLinkedData('Document');

                const response: any = await CallRPCMethod(RPCDocumentList.Get, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                });

                expect(response.success).toBeTruthy();
                expect(response.vault_id).toEqual(vaultId);
                expect(response.wallet_id).toEqual(fullWallet1.id);
                expect(response.document).toBeDefined();
                expect(response.document.content).toEqual(getPrimitiveData('Document').content);
                expect(response.document.fields.name).toEqual(getPrimitiveData('Document').fields.name);

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
                await CallRPCMethod(RPCDocumentList.Count, {});
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
                await CallRPCMethod(RPCDocumentList.Count, {
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
                await CallRPCMethod(RPCDocumentList.Count, {
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
                await CallRPCMethod(RPCDocumentList.Count, {
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
                await CallRPCMethod(RPCDocumentList.Count, {
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

        it(`Counts Documents in List`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCDocumentList.Count, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.count).toEqual(0);

                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });

                result = await CallRPCMethod(RPCDocumentList.Count, {
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
                await CallRPCMethod(RPCDocumentList.List, {});
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
                await CallRPCMethod(RPCDocumentList.List, {
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
                await CallRPCMethod(RPCDocumentList.List, {
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
                await CallRPCMethod(RPCDocumentList.List, {
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
                await CallRPCMethod(RPCDocumentList.List, {
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

        it(`Lists Documents`, mochaAsync(async () => {
            try {
                let result: any = await CallRPCMethod(RPCDocumentList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.document_list).toEqual([]);

                await CallRPCMethod(RPCDocumentList.Add, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                    linkId: linkId,
                    linkEntry: getNockableLink('Document'),
                });

                result = await CallRPCMethod(RPCDocumentList.List, {
                    storageCredentials: localStorage.id,
                    vaultWallet: fullWallet1.id,
                    vault: vaultId,
                });

                expect(result.success).toBeTruthy();
                expect(result.document_list).toEqual([linkId]);

            } catch (err) {
                fail(`Should not have thrown [${err}]`);
            }
        }));
    });

};
