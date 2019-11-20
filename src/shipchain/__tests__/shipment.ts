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
import { Shipment, ShipmentItemProperties } from "../vaults/primitives/Shipment";
import { ItemProperties } from "../vaults/primitives/Item";
import { ProductProperties } from "../vaults/primitives/Product";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


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

    let refreshPrimitive = async(): Promise<Shipment> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Shipment');
    };

    let injectPrimitive = async (): Promise<Shipment> => {
        vault.injectPrimitive('Shipment');
        return await refreshPrimitive();
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

            shipment = await refreshPrimitive();

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
            await shipment.addDocument(author, 'docId', getNockableLink('Document'));
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addDocument(author, 'docId', getNockableLink('Document'));

            shipment = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');

            let document = await shipment.getDocument(author, 'docId');
            expect(document.fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(thisDocumentNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let shipment = await injectPrimitive();
            let list = await shipment.listDocuments(author);
            expect(list).toEqual([]);

            await shipment.addDocument(author, 'docId', getNockableLink('Document'));

            shipment = await refreshPrimitive();

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
            await shipment.addItem(author, 'itemId', getNockableLink('Item'));
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addItem(author, 'itemId', getNockableLink('Item'));

            shipment = await refreshPrimitive();

            const thisItemNock = nockLinkedData('Item');
            const thisDocumentNock = nockLinkedData('Document');
            const thisProductNock = nockLinkedData('Product');

            let shipmentItemProperties: ShipmentItemProperties = await shipment.getItem(author, 'itemId');
            let itemProperties: ItemProperties = shipmentItemProperties.item as ItemProperties;
            let productProperties: ProductProperties = itemProperties.product as ProductProperties;

            expect(itemProperties.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
            expect(productProperties.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(productProperties.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can have a variable quantity`, async () => {
            let shipment = await injectPrimitive();
            await shipment.addItem(author, 'itemId', getNockableLink('Item'), 7);

            shipment = await refreshPrimitive();

            const thisItemNock = nockLinkedData('Item');
            const thisDocumentNock = nockLinkedData('Document');
            const thisProductNock = nockLinkedData('Product');

            let shipmentItemProperties: ShipmentItemProperties = await shipment.getItem(author, 'itemId');
            let itemProperties: ItemProperties = shipmentItemProperties.item as ItemProperties;

            expect(shipmentItemProperties.quantity).toEqual(7);
            expect(itemProperties.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);

            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let shipment = await injectPrimitive();
            let list = await shipment.listItems(author);
            expect(list).toEqual([]);

            await shipment.addItem(author, 'itemId', getNockableLink('Item'));

            shipment = await refreshPrimitive();

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
            await shipment.setTracking(author, getNockableLink('Tracking'));
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setTracking(author, getNockableLink('Tracking'));

            shipment = await refreshPrimitive();

            const thisTrackingNock = nockLinkedData('Tracking');

            let tracking = await shipment.getTracking(author);
            expect(tracking.length).toEqual(getPrimitiveData('Tracking').length);
            expect(tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);
            expect(thisTrackingNock.isDone()).toBeTruthy();
        });
    });

    describe(`telemetry`, async () => {

        it(`needs valid linkEntry`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.setTelemetry(author, "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Telemetry] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let shipment = await injectPrimitive();

            let caughtError;

            try {
                await shipment.getTelemetry(author);
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Telemetry not found in Shipment`);
        });

        it(`can set`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setTelemetry(author, getNockableLink('Telemetry'));
        });

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setTelemetry(author, getNockableLink('Telemetry'));

            shipment = await refreshPrimitive();

            const thisTelemetryNock = nockLinkedData('Telemetry');

            let telemetry = await shipment.getTelemetry(author);
            expect(telemetry.length).toEqual(getPrimitiveData('Telemetry').length);
            expect(telemetry[0]).toEqual(getPrimitiveData('Telemetry')[0]);
            expect(thisTelemetryNock.isDone()).toBeTruthy();
        });
    });

    describe(`full primitive`, async () => {

        it(`can be retrieved`, async () => {
            let shipment = await injectPrimitive();
            await shipment.setFields(author, {
                id: 'c70a9b2f-bad9-4ace-b981-807cbb44782d',
            });
            await shipment.addDocument(author, 'docId', getNockableLink('Document'));
            await shipment.addItem(author, 'itemId', getNockableLink('Item'));
            await shipment.setTracking(author, getNockableLink('Tracking'));
            await shipment.setTelemetry(author, getNockableLink('Telemetry'));

            shipment = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document', 2);
            const thisItemNock = nockLinkedData('Item');
            const thisProductNock = nockLinkedData('Product');
            const thisTrackingNock = nockLinkedData('Tracking');
            const thisTelemetryNock = nockLinkedData('Telemetry');

            let fullShipment = await shipment.getShipment(author);

            //@ts-ignore
            expect(fullShipment.fields.id).toEqual('c70a9b2f-bad9-4ace-b981-807cbb44782d');
            expect(fullShipment.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(fullShipment.items['itemId'].quantity).toEqual(1);
            expect(fullShipment.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
            expect(fullShipment.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
            expect(fullShipment.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(fullShipment.tracking.length).toEqual(getPrimitiveData('Tracking').length);
            expect(fullShipment.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);
            expect(fullShipment.telemetry.length).toEqual(getPrimitiveData('Telemetry').length);
            expect(fullShipment.telemetry[0]).toEqual(getPrimitiveData('Telemetry')[0]);

            expect(thisDocumentNock.isDone()).toBeTruthy();
            expect(thisItemNock.isDone()).toBeTruthy();
            expect(thisProductNock.isDone()).toBeTruthy();
            expect(thisTrackingNock.isDone()).toBeTruthy();
            expect(thisTelemetryNock.isDone()).toBeTruthy();
        });
    });

};
