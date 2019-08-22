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




import { ItemProperties } from "../vaults/primitives/Item";

require('../../__tests__/testLoggingConfig');

import 'mocha';
import { ShipChainVault } from '../vaults/ShipChainVault';
import { Shipment, ShipmentItemProperties } from "../vaults/primitives/Shipment";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };

const nock = require('nock');
const nockedUrl = 'http://nocked-url:2000';

const nockedDocumentResponse = {
    'jsonrpc': '2.0',
    'result': '{"fields":{"name":"Remote Document"},"content": null}',
    'id': 0,
};
const nockedTrackingResponse = {
    'jsonrpc': '2.0',
    'result': [{"one": 1}],
    'id': 0,
};
const nockedItemResponse = {
    'jsonrpc': '2.0',
    'result': '{"fields":{"serial_number":"Remote Item Serial #"},"product": null}',
    'id': 0,
};

const validDocumentLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Document`;
const validTrackingLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Tracking`;
const validItemLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Item`;


export const ShipmentPrimitiveTests = async function() {
    let author: Wallet;
    let vault: ShipChainVault;

    beforeAll(async () => {
        await EncryptorContainer.init();
        author = await Wallet.generate_entity();
    });

    beforeEach(async() => {
        vault = new ShipChainVault(storage_driver);
        await vault.getOrCreateMetadata(author);
    });

    afterEach(async() => {
        await vault.deleteEverything();
    });

    afterAll(async () => {
        CloseConnection();
    });

    let injectPrimitive = async (): Promise<Shipment> => {
        vault.injectPrimitive('Shipment');
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Shipment');
    };

    it(`can be created`, async () => {
        let shipment = new Shipment(vault);

        expect(shipment.name).toEqual('Shipment');
        expect(shipment.container_type).toEqual('embedded_file');
        expect(shipment.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let shipment = new Shipment(vault);

        let shipmentProperties = await shipment.getShipment(author);

        expect(shipmentProperties.fields).toEqual({});
        expect(shipmentProperties.documents).toEqual({});
        expect(shipmentProperties.tracking).toBeNull();
        expect(shipmentProperties.items).toEqual({});
    });

    describe(`fields`, async () => {

        it(`can be set`, async () => {
            let shipment = await injectPrimitive();

            await shipment.setFields(author, {
                id: 'c70a9b2f-bad9-4ace-b981-807cbb44782d',
            });
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setFields(author, {
                id: 'c70a9b2f-bad9-4ace-b981-807cbb44782d',
            });

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            let shipmentFields = await shipment.getFields(author);
            expect(shipmentFields.id).toEqual('c70a9b2f-bad9-4ace-b981-807cbb44782d');
        });
    });

    describe(`documents`, async () => {

        it(`needs valid linkEntry`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.addDocument(author, "docId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Document] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.getDocument(author, "unknownDoc");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Document 'unknownDoc' not found in Shipment`);
        });

        it(`can add`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addDocument(author, 'docId', validDocumentLink);
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addDocument(author, 'docId', validDocumentLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedDocumentResponse);

            let document = await shipment.getDocument(author, 'docId');
            expect(document.fields.name).toEqual('Remote Document');
            expect(thisNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let shipment = await injectPrimitive();
            let list = await shipment.listDocuments(author);
            expect(list).toEqual([]);

            await shipment.addDocument(author, 'docId', validDocumentLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            list = await shipment.listDocuments(author);
            expect(list).toEqual(['docId']);
        });
    });

    describe(`items`, async () => {

        it(`needs valid linkEntry`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.addItem(author, "itemId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Item] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.getItem(author, "unknownItem");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Item 'unknownItem' not found in Shipment`);
        });

        it(`can add`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addItem(author, 'itemId', validItemLink);
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addItem(author, 'itemId', validItemLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedItemResponse);

            let shipmentItemProperties: ShipmentItemProperties = await shipment.getItem(author, 'itemId');
            let itemProperties: ItemProperties = shipmentItemProperties.item as ItemProperties;
            expect(itemProperties.fields.serial_number).toEqual('Remote Item Serial #');
            expect(thisNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let shipment = await injectPrimitive();
            let list = await shipment.listItems(author);
            expect(list).toEqual([]);

            await shipment.addItem(author, 'itemId', validItemLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            list = await shipment.listItems(author);
            expect(list).toEqual(['itemId']);
        });
    });

    describe(`tracking`, async () => {

        it(`needs valid linkEntry`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.setTracking(author, "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Tracking] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.getTracking(author);
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Tracking not found in Shipment`);
        });

        it(`can set`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setTracking(author, validTrackingLink);
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setTracking(author, validTrackingLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedTrackingResponse);

            let tracking = await shipment.getTracking(author);
            expect(tracking.length).toEqual(1);
            expect(tracking[0]).toEqual({one: 1});
            expect(thisNock.isDone()).toBeTruthy();
        });
    });

    // describe(`full primitive`, async () => {
    //
    //     it(`can be retrieved`, async () => {
    //         let shipment = await injectPrimitive();
    //         await shipment.setFields(author, {
    //             serial_number: 'serial #',
    //         });
    //         await shipment.setProduct(author, validProductLink);
    //
    //         await vault.writeMetadata(author);
    //         await vault.loadMetadata();
    //
    //         const thisNock = nock(nockedUrl)
    //             .post('', (body) => {
    //                 return body.method === 'vaults.linked.get_linked_data';
    //             }).reply(200, nockedDocumentResponse);
    //
    //         let product = await shipment.getProduct(author);
    //         expect(product.fields.name).toEqual('Remote Product');
    //         expect(thisNock.isDone()).toBeTruthy();
    //     });
    // });

};
