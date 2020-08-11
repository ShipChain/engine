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
import { RemoteVault } from "../../vaults/RemoteVault";
import { ShipChainVault } from '../vaults/ShipChainVault';
import { ShipmentList } from "../vaults/primitives/ShipmentList";
import { ShipmentProperties } from "../vaults/primitives/Shipment";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ShipmentListPrimitiveTests = function() {
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

    let refreshPrimitive = async(): Promise<ShipmentList> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('ShipmentList');
    };

    let injectPrimitive = async (): Promise<ShipmentList> => {
        vault.injectPrimitive('ShipmentList');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let shipmentList = new ShipmentList(vault);

        expect(shipmentList.name).toEqual('ShipmentList');
        expect(shipmentList.container_type).toEqual('link');
        expect(shipmentList.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let shipmentList = new ShipmentList(vault);

        expect(shipmentList.count()).toEqual(0);
        expect(shipmentList.list()).toEqual([]);
    });

    it(`throws if retrieving unknown linkId`, async () => {
        let shipmentList = await injectPrimitive();

        let caughtError;

        try {
            await shipmentList.getEntity('unknownLink');
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`LinkID [unknownLink] not found!`);
    });

    it(`throws if adding invalid linkEntry`, async () => {
        let shipmentList = await injectPrimitive();

        let caughtError;

        try {
            await shipmentList.addEntity(author, 'badLink', RemoteVault.buildLinkEntry(getNockableLink('Item')));
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Expecting Link to [Shipment] instead received [Item]`);
    });

    it(`adds valid linkEntry`, async () => {
        let shipmentList = await injectPrimitive();
        await shipmentList.addEntity(author, 'shipmentId', RemoteVault.buildLinkEntry(getNockableLink('Shipment')));
    });

    it(`can return valid linkEntry`, async () => {
        let shipmentList = await injectPrimitive();
        await shipmentList.addEntity(author, 'shipmentId', RemoteVault.buildLinkEntry(getNockableLink('Shipment')));

        shipmentList = await refreshPrimitive();

        const thisDocumentNock = nockLinkedData('Document', 2);
        const thisItemNock = nockLinkedData('Item');
        const thisProductNock = nockLinkedData('Product');
        const thisTrackingNock = nockLinkedData('Tracking');
        const thisShipmentNock = nockLinkedData('Shipment');

        let fullShipment = await shipmentList.getEntity('shipmentId') as ShipmentProperties;


        //@ts-ignore
        expect(fullShipment.fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
        expect(fullShipment.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
        expect(fullShipment.items['itemId'].quantity).toEqual(1);
        expect(fullShipment.items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
        expect(fullShipment.items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
        expect(fullShipment.items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
        expect(fullShipment.tracking.length).toEqual(getPrimitiveData('Tracking').length);
        expect(fullShipment.tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);

        expect(thisShipmentNock.isDone()).toBeTruthy();
        expect(thisDocumentNock.isDone()).toBeTruthy();
        expect(thisItemNock.isDone()).toBeTruthy();
        expect(thisProductNock.isDone()).toBeTruthy();
        expect(thisTrackingNock.isDone()).toBeTruthy();
    });

    it(`can list`, async () => {
        let itemList = await injectPrimitive();
        await itemList.addEntity(author, 'shipmentId', RemoteVault.buildLinkEntry(getNockableLink('Shipment')));
        await itemList.addEntity(author, 'shipmentId2', RemoteVault.buildLinkEntry(getNockableLink('Shipment')));

        itemList = await refreshPrimitive();

        let list = await itemList.list();

        expect(list.length).toEqual(2);
        expect(list[0]).toEqual('shipmentId');
        expect(list[1]).toEqual('shipmentId2');
    });

};
