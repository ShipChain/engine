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
import { ItemList } from "../vaults/primitives/ItemList";
import { ItemProperties } from "../vaults/primitives/Item";
import { ProductProperties } from "../vaults/primitives/Product";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ItemListPrimitiveTests = async function() {
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

    let refreshPrimitive = async(): Promise<ItemList> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('ItemList');
    };

    let injectPrimitive = async (): Promise<ItemList> => {
        vault.injectPrimitive('ItemList');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let itemList = new ItemList(vault);

        expect(itemList.name).toEqual('ItemList');
        expect(itemList.container_type).toEqual('link');
        expect(itemList.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let itemList = new ItemList(vault);

        expect(itemList.count()).toEqual(0);
        expect(itemList.list()).toEqual([]);
    });

    it(`throws if retrieving unknown linkId`, async () => {
        let itemList = await injectPrimitive();

        let caughtError;

        try {
            await itemList.getEntity('unknownLink');
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`LinkID [unknownLink] not found!`);
    });

    it(`throws if adding invalid linkEntry`, async () => {
        let itemList = await injectPrimitive();

        let caughtError;

        try {
            await itemList.addEntity(author, 'badLink', RemoteVault.buildLinkEntry(getNockableLink('Product')));
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Expecting Link to [Item] instead received [Product]`);
    });

    it(`adds valid linkEntry`, async () => {
        let itemList = await injectPrimitive();
        await itemList.addEntity(author, 'itemId', RemoteVault.buildLinkEntry(getNockableLink('Item')));
    });

    it(`can return valid linkEntry`, async () => {
        let itemList = await injectPrimitive();
        await itemList.addEntity(author, 'itemId', RemoteVault.buildLinkEntry(getNockableLink('Item')));

        itemList = await refreshPrimitive();

        const thisItemNock = nockLinkedData('Item');
        const thisProductNock = nockLinkedData('Product');
        const thisDocumentNock = nockLinkedData('Document');

        let fullItem = await itemList.getEntity('itemId') as ItemProperties;
        let fullItemProduct = fullItem.product as ProductProperties;

        expect(fullItem.fields.serial_number).toEqual(getPrimitiveData('Item').fields.serial_number);
        expect(fullItemProduct.fields.name).toEqual(getPrimitiveData('Product').fields.name);
        expect(fullItemProduct.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

        expect(thisItemNock.isDone()).toBeTruthy();
        expect(thisProductNock.isDone()).toBeTruthy();
        expect(thisDocumentNock.isDone()).toBeTruthy();
    });

    it(`can list`, async () => {
        let itemList = await injectPrimitive();
        await itemList.addEntity(author, 'itemId', RemoteVault.buildLinkEntry(getNockableLink('Item')));
        await itemList.addEntity(author, 'itemId2', RemoteVault.buildLinkEntry(getNockableLink('Item')));

        itemList = await refreshPrimitive();

        let list = await itemList.list();

        expect(list.length).toEqual(2);
        expect(list[0]).toEqual('itemId');
        expect(list[1]).toEqual('itemId2');
    });

};
