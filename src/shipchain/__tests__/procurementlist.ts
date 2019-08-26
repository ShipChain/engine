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
import { ProcurementList } from "../vaults/primitives/ProcurementList";
import { ProcurementProperties } from "../vaults/primitives/Procurement";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ProcurementListPrimitiveTests = async function() {
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

    let refreshPrimitive = async(): Promise<ProcurementList> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('ProcurementList');
    };

    let injectPrimitive = async (): Promise<ProcurementList> => {
        vault.injectPrimitive('ProcurementList');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let procurementList = new ProcurementList(vault);

        expect(procurementList.name).toEqual('ProcurementList');
        expect(procurementList.container_type).toEqual('link');
        expect(procurementList.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let procurementList = new ProcurementList(vault);

        expect(procurementList.count()).toEqual(0);
        expect(procurementList.list()).toEqual([]);
    });

    it(`throws if retrieving unknown linkId`, async () => {
        let procurementList = await injectPrimitive();

        let caughtError;

        try {
            await procurementList.getEntity('unknownLink');
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`LinkID [unknownLink] not found!`);
    });

    it(`throws if adding invalid linkEntry`, async () => {
        let procurementList = await injectPrimitive();

        let caughtError;

        try {
            await procurementList.addEntity(author, 'badLink', RemoteVault.buildLinkEntry(getNockableLink('Item')));
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Expecting Link to [Procurement] instead received [Item]`);
    });

    it(`adds valid linkEntry`, async () => {
        let procurementList = await injectPrimitive();
        await procurementList.addEntity(author, 'procurementId', RemoteVault.buildLinkEntry(getNockableLink('Procurement')));
    });

    it(`can return valid linkEntry`, async () => {
        let procurementList = await injectPrimitive();
        await procurementList.addEntity(author, 'procurementId', RemoteVault.buildLinkEntry(getNockableLink('Procurement')));

        procurementList = await refreshPrimitive();

        const thisDocumentNock = nockLinkedData('Document', 4);
        const thisItemNock = nockLinkedData('Item');
        const thisProductNock = nockLinkedData('Product', 2);
        const thisTrackingNock = nockLinkedData('Tracking');
        const thisShipmentNock = nockLinkedData('Shipment');
        const thisProcurementNock = nockLinkedData('Procurement');

        let fullProcurement = await procurementList.getEntity('procurementId') as ProcurementProperties;

        expect(fullProcurement.fields.name).toEqual(getPrimitiveData('Procurement').fields.name);
        expect(fullProcurement.shipments['shipmentId'].fields.id).toEqual(getPrimitiveData('Shipment').fields.id);
        expect(fullProcurement.shipments['shipmentId'].documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
        expect(fullProcurement.shipments['shipmentId'].items['itemId'].quantity).toEqual(1);
        expect(fullProcurement.shipments['shipmentId'].items['itemId'].item.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
        expect(fullProcurement.shipments['shipmentId'].items['itemId'].item.product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
        expect(fullProcurement.shipments['shipmentId'].items['itemId'].item.product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
        expect(fullProcurement.shipments['shipmentId'].tracking.length).toEqual(getPrimitiveData('Tracking').length);
        expect(fullProcurement.shipments['shipmentId'].tracking[0]).toEqual(getPrimitiveData('Tracking')[0]);
        expect(fullProcurement.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
        expect(fullProcurement.products['productId'].quantity).toEqual(1);
        expect(fullProcurement.products['productId'].product.fields.name).toEqual(getPrimitiveData('Product').fields.name);
        expect(fullProcurement.products['productId'].product.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

        expect(thisProcurementNock.isDone()).toBeTruthy();
        expect(thisShipmentNock.isDone()).toBeTruthy();
        expect(thisDocumentNock.isDone()).toBeTruthy();
        expect(thisItemNock.isDone()).toBeTruthy();
        expect(thisProductNock.isDone()).toBeTruthy();
        expect(thisTrackingNock.isDone()).toBeTruthy();
    });

    it(`can list`, async () => {
        let procurementList = await injectPrimitive();
        await procurementList.addEntity(author, 'procurementId', RemoteVault.buildLinkEntry(getNockableLink('Procurement')));
        await procurementList.addEntity(author, 'procurementId2', RemoteVault.buildLinkEntry(getNockableLink('Procurement')));

        procurementList = await refreshPrimitive();

        let list = await procurementList.list();

        expect(list.length).toEqual(2);
        expect(list[0]).toEqual('procurementId');
        expect(list[1]).toEqual('procurementId2');
    });

};
