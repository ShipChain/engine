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

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


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
            await procurement.addShipment(author, 'shipId', getNockableLink('Shipment'));
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addShipment(author, 'shipId', getNockableLink('Shipment'));

            procurement = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document', 2);
            const thisItemNock = nockLinkedData('Item');
            const thisProductNock = nockLinkedData('Product');
            const thisTrackingNock = nockLinkedData('Tracking');
            const thisShipmentNock = nockLinkedData('Shipment');

            let shipmentProperties: ShipmentProperties = await procurement.getShipment(author, 'shipId');

            //@ts-ignore
            expect(shipmentProperties.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
            expect(shipmentProperties.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(shipmentProperties.items['itemId'].quantity).toEqual(1);
            expect(shipmentProperties.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
            expect(shipmentProperties.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(shipmentProperties.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(shipmentProperties.tracking.length).toEqual(getPrimitiveData('Tracking').length);
            expect(shipmentProperties.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);

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

            await procurement.addShipment(author, 'shipId', getNockableLink('Shipment'));

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
            await procurement.addDocument(author, 'docId', getNockableLink('Document'));
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addDocument(author, 'docId', getNockableLink('Document'));

            procurement = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');

            let document = await procurement.getDocument(author, 'docId');
            expect(document.fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(thisDocumentNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let procurement = await injectPrimitive();
            let list = await procurement.listDocuments(author);
            expect(list).toEqual([]);

            await procurement.addDocument(author, 'docId', getNockableLink('Document'));

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
            await procurement.addProduct(author, 'productId', getNockableLink('Product'));
        });

        it(`can be retrieved`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addProduct(author, 'productId', getNockableLink('Product'));

            procurement = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');
            const thisProductNock = nockLinkedData('Product');

            let procurementProductProperties: ProcurementProductProperties = await procurement.getProduct(author, 'productId');
            let productProperties: ProductProperties = procurementProductProperties.product as ProductProperties;

            expect(procurementProductProperties.quantity).toEqual(1);
            expect(productProperties.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(productProperties.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can have a variable quantity`, async () => {
            let procurement = await injectPrimitive();
            await procurement.addProduct(author, 'productId', getNockableLink('Product'), 7);

            procurement = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');
            const thisProductNock = nockLinkedData('Product');

            let procurementProductProperties: ProcurementProductProperties = await procurement.getProduct(author, 'productId');

            expect(procurementProductProperties.quantity).toEqual(7);

            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let procurement = await injectPrimitive();
            let list = await procurement.listProducts(author);
            expect(list).toEqual([]);

            await procurement.addProduct(author, 'productId', getNockableLink('Product'));

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
            await procurement.addShipment(author, 'shipId', getNockableLink('Shipment'));
            await procurement.addDocument(author, 'docId', getNockableLink('Document'));
            await procurement.addProduct(author, 'productId', getNockableLink('Product'));

            procurement = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document', 4);
            const thisItemNock = nockLinkedData('Item');
            const thisProductNock = nockLinkedData('Product', 2);
            const thisTrackingNock = nockLinkedData('Tracking');
            const thisShipmentNock = nockLinkedData('Shipment');

            let fullProcurement = await procurement.getProcurement(author);

            //@ts-ignore
            expect(fullProcurement.fields.name).toEqual('procurement name');

            expect(fullProcurement.shipments['shipId'].fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
            expect(fullProcurement.shipments['shipId'].documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(fullProcurement.shipments['shipId'].items['itemId'].quantity).toEqual(1);
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(fullProcurement.shipments['shipId'].items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(fullProcurement.shipments['shipId'].tracking.length).toEqual(getPrimitiveData('Tracking').length);
            expect(fullProcurement.shipments['shipId'].tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);

            expect(fullProcurement.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

            expect(fullProcurement.products['productId'].quantity).toEqual(1);
            expect(fullProcurement.products['productId'].product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(fullProcurement.products['productId'].product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

            expect(thisShipmentNock.isDone()).toBeTruthy();
            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
            expect(thisTrackingNock.isDone()).toBeTruthy();
        });
    });

};
