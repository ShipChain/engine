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




require('../../__tests__/testLoggingConfig');

import 'mocha';
import { ShipChainVault } from '../vaults/ShipChainVault';
import { Procurement, ProcurementProductProperties } from "../vaults/primitives/Procurement";
import { ProductProperties } from "../vaults/primitives/Product";
import { ShipmentProperties } from "../vaults/primitives/Shipment";
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

const validDocumentLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Document`;

const nockedProductResponse = {
    'jsonrpc': '2.0',
    'result': `{"fields":{"name":"Remote Product"},"documents":{"docId": "${validDocumentLink}"}}`,
    'id': 0,
};
const validProductLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Product`;


const nockedTrackingResponse = {
    'jsonrpc': '2.0',
    'result': [{"one": 1}],
    'id': 0,
};
const nockedItemResponse = {
    'jsonrpc': '2.0',
    'result': `{"fields":{"serial_number":"Remote Item Serial #"},"product": "${validProductLink}"}`,
    'id': 0,
};

const validTrackingLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Tracking`;
const validItemLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Item`;

const nockedShipmentResponse = {
    'jsonrpc': '2.0',
    'result': JSON.stringify({
        "fields": {
            "id":"c70a9b2f-bad9-4ace-b981-807cbb44782d"
        },
        "documents": {
            "docId": validDocumentLink
        },
        "tracking": validTrackingLink,
        "items": {
            "itemId": {
                "quantity": 1,
                "item": validItemLink
            }
        }
    }),
    'id': 0,
};
const validShipmentLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Shipment`;


export const ProcurementPrimitiveTests = async function() {
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

    let refreshPrimitive = async(): Promise<Procurement> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Procurement');
    };

    let injectPrimitive = async (): Promise<Procurement> => {
        vault.injectPrimitive('Procurement');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let procurement = new Procurement(vault);

        expect(procurement.name).toEqual('Procurement');
        expect(procurement.container_type).toEqual('embedded_file');
        expect(procurement.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let procurement = new Procurement(vault);

        let procurementProperties = await procurement.getProcurement(author);

        expect(procurementProperties.fields).toEqual({});
        expect(procurementProperties.shipments).toEqual({});
        expect(procurementProperties.documents).toEqual({});
        expect(procurementProperties.products).toEqual({});
    });

    describe(`fields`, async () => {

        it(`can be set`, async () => {
            let procurement = await injectPrimitive();

            await procurement.setFields(author, {
                name: 'procurement name',
            });
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.setFields(author, {
                name: 'procurement name',
            });

            procurement = await refreshPrimitive();

            let procurementFields = await procurement.getFields(author);
            expect(procurementFields.name).toEqual('procurement name');
        });
    });

    describe(`shipments`, async () => {

        it(`needs valid linkEntry`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.addShipment(author, "shipId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Shipment] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.getShipment(author, "unknownShip");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Shipment 'unknownShip' not found in Procurement`);
        });

        it(`can add`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addShipment(author, 'shipId', validShipmentLink);
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addShipment(author, 'shipId', validShipmentLink);

            procurement = await refreshPrimitive();

            const thisDocumentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Document';
                })
                .twice()
                .reply(200, nockedDocumentResponse);

            const thisItemNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Item';
                }).reply(200, nockedItemResponse);

            const thisProductNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Product';
                }).reply(200, nockedProductResponse);

            const thisTrackingNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Tracking';
                }).reply(200, nockedTrackingResponse);

            const thisShipmentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Shipment';
                }).reply(200, nockedShipmentResponse);

            let shipmentProperties: ShipmentProperties = await procurement.getShipment(author, 'shipId');

            //@ts-ignore
            expect(shipmentProperties.fields.id).toEqual('c70a9b2f-bad9-4ace-b981-807cbb44782d');
            expect(shipmentProperties.documents['docId'].fields.name).toEqual('Remote Document');
            expect(shipmentProperties.items['itemId'].quantity).toEqual(1);
            expect(shipmentProperties.items['itemId'].item.fields.serial_number).toEqual('Remote Item Serial #');
            expect(shipmentProperties.items['itemId'].item.product.fields.name).toEqual('Remote Product');
            expect(shipmentProperties.items['itemId'].item.product.documents['docId'].fields.name).toEqual('Remote Document');
            expect(shipmentProperties.tracking.length).toEqual(1);
            expect(shipmentProperties.tracking[0]).toEqual({one: 1});

            expect(thisShipmentNock.isDone()).toBeTruthy();
            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
            expect(thisTrackingNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let procurement = await injectPrimitive();
            let list = await procurement.listShipments(author);
            expect(list).toEqual([]);

            await procurement.addShipment(author, 'shipId', validShipmentLink);

            procurement = await refreshPrimitive();

            list = await procurement.listShipments(author);
            expect(list).toEqual(['shipId']);
        });
    });

    describe(`documents`, async () => {

        it(`needs valid linkEntry`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.addDocument(author, "docId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Document] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.getDocument(author, "unknownDoc");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Document 'unknownDoc' not found in Procurement`);
        });

        it(`can add`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addDocument(author, 'docId', validDocumentLink);
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addDocument(author, 'docId', validDocumentLink);

            procurement = await refreshPrimitive();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedDocumentResponse);

            let document = await procurement.getDocument(author, 'docId');
            expect(document.fields.name).toEqual('Remote Document');
            expect(thisNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let procurement = await injectPrimitive();
            let list = await procurement.listDocuments(author);
            expect(list).toEqual([]);

            await procurement.addDocument(author, 'docId', validDocumentLink);

            procurement = await refreshPrimitive();

            list = await procurement.listDocuments(author);
            expect(list).toEqual(['docId']);
        });
    });

    describe(`products`, async () => {

        it(`needs valid linkEntry`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.addProduct(author, "productId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Product] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let procurement = await injectPrimitive();

            let caughtError;

            try {
                await procurement.getProduct(author, "unknownProduct");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Product 'unknownProduct' not found in Procurement`);
        });

        it(`can add`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addProduct(author, 'productId', validProductLink);
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addProduct(author, 'productId', validProductLink);

            procurement = await refreshPrimitive();

            const thisDocumentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Document';
                }).reply(200, nockedDocumentResponse);

            const thisProductNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Product';
                }).reply(200, nockedProductResponse);

            let procurementProductProperties: ProcurementProductProperties = await procurement.getProduct(author, 'productId');
            let productProperties: ProductProperties = procurementProductProperties.product as ProductProperties;

            expect(procurementProductProperties.quantity).toEqual(1);
            expect(productProperties.fields.name).toEqual('Remote Product');
            expect(productProperties.documents['docId'].fields.name).toEqual('Remote Document');

            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can have a variable quantity`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addProduct(author, 'productId', validProductLink, 7);

            procurement = await refreshPrimitive();

            const thisDocumentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Document';
                }).reply(200, nockedDocumentResponse);

            const thisProductNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Product';
                }).reply(200, nockedProductResponse);

            let procurementProductProperties: ProcurementProductProperties = await procurement.getProduct(author, 'productId');

            expect(procurementProductProperties.quantity).toEqual(7);

            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let procurement = await injectPrimitive();
            let list = await procurement.listProducts(author);
            expect(list).toEqual([]);

            await procurement.addProduct(author, 'productId', validProductLink);

            procurement = await refreshPrimitive();

            list = await procurement.listProducts(author);
            expect(list).toEqual(['productId']);
        });
    });

    describe(`full primitive`, async () => {

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.setFields(author, {
                name: 'procurement name',
            });
            await procurement.addShipment(author, 'shipId', validShipmentLink);
            await procurement.addDocument(author, 'docId', validDocumentLink);
            await procurement.addProduct(author, 'productId', validProductLink);

            procurement = await refreshPrimitive();

            const thisDocumentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Document';
                })
                .times(4)
                .reply(200, nockedDocumentResponse);

            const thisItemNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Item';
                }).reply(200, nockedItemResponse);

            const thisProductNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Product';
                })
                .times(2)
                .reply(200, nockedProductResponse);

            const thisTrackingNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Tracking';
                }).reply(200, nockedTrackingResponse);

            const thisShipmentNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data' &&
                        body.params &&
                        body.params.linkEntry &&
                        body.params.linkEntry.container === 'Shipment';
                }).reply(200, nockedShipmentResponse);


            let fullProcurement = await procurement.getProcurement(author);

            //@ts-ignore
            expect(fullProcurement.fields.name).toEqual('procurement name');

            expect(fullProcurement.shipments['shipId'].fields.id).toEqual('c70a9b2f-bad9-4ace-b981-807cbb44782d');
            expect(fullProcurement.shipments['shipId'].documents['docId'].fields.name).toEqual('Remote Document');
            expect(fullProcurement.shipments['shipId'].items['itemId'].quantity).toEqual(1);
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.fields.serial_number).toEqual('Remote Item Serial #');
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.product.fields.name).toEqual('Remote Product');
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.product.documents['docId'].fields.name).toEqual('Remote Document');
            expect(fullProcurement.shipments['shipId'].tracking.length).toEqual(1);
            expect(fullProcurement.shipments['shipId'].tracking[0]).toEqual({one: 1});

            expect(fullProcurement.documents['docId'].fields.name).toEqual('Remote Document');

            expect(fullProcurement.products['productId'].quantity).toEqual(1);
            expect(fullProcurement.products['productId'].product.fields.name).toEqual('Remote Product');
            expect(fullProcurement.products['productId'].product.documents['docId'].fields.name).toEqual('Remote Document');

            expect(thisShipmentNock.isDone()).toBeTruthy();
            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
            expect(thisTrackingNock.isDone()).toBeTruthy();
        });
    });

};
