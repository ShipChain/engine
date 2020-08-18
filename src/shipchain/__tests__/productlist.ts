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
import { ProductList } from "../vaults/primitives/ProductList";
import { ProductProperties } from "../vaults/primitives/Product";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ProductListPrimitiveTests = function() {
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

    let refreshPrimitive = async(): Promise<ProductList> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('ProductList');
    };

    let injectPrimitive = async (): Promise<ProductList> => {
        vault.injectPrimitive('ProductList');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let productList = new ProductList(vault);

        expect(productList.name).toEqual('ProductList');
        expect(productList.container_type).toEqual('link');
        expect(productList.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let productList = new ProductList(vault);

        expect(productList.count()).toEqual(0);
        expect(productList.list()).toEqual([]);
    });

    it(`throws if retrieving unknown linkId`, async () => {
        let productList = await injectPrimitive();

        let caughtError;

        try {
            await productList.getEntity('unknownLink');
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`LinkID [unknownLink] not found!`);
    });

    it(`throws if adding invalid linkEntry`, async () => {
        let productList = await injectPrimitive();

        let caughtError;

        try {
            await productList.addEntity(author, 'badLink', RemoteVault.buildLinkEntry(getNockableLink('Item')));
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Expecting Link to [Product] instead received [Item]`);
    });

    it(`adds valid linkEntry`, async () => {
        let productList = await injectPrimitive();
        await productList.addEntity(author, 'productId', RemoteVault.buildLinkEntry(getNockableLink('Product')));
    });

    it(`can return valid linkEntry`, async () => {
        let productList = await injectPrimitive();
        await productList.addEntity(author, 'productId', RemoteVault.buildLinkEntry(getNockableLink('Product')));

        productList = await refreshPrimitive();

        const thisProductNock = nockLinkedData('Product');
        const thisDocumentNock = nockLinkedData('Document');

        let fullProduct = await productList.getEntity('productId') as ProductProperties;

        expect(fullProduct.fields.name).toEqual(getPrimitiveData('Product').fields.name);
        expect(fullProduct.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);

        expect(thisProductNock.isDone()).toBeTruthy();
        expect(thisDocumentNock.isDone()).toBeTruthy();
    });

    it(`can list`, async () => {
        let itemList = await injectPrimitive();
        await itemList.addEntity(author, 'productId', RemoteVault.buildLinkEntry(getNockableLink('Product')));
        await itemList.addEntity(author, 'productId2', RemoteVault.buildLinkEntry(getNockableLink('Product')));

        itemList = await refreshPrimitive();

        let list = await itemList.list();

        expect(list.length).toEqual(2);
        expect(list[0]).toEqual('productId');
        expect(list[1]).toEqual('productId2');
    });

};
