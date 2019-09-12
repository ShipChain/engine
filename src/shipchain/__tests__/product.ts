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
import { Product } from "../vaults/primitives/Product";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ProductPrimitiveTests = async function() {
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

    let refreshPrimitive = async(): Promise<Product> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Product');
    };

    let injectPrimitive = async (): Promise<Product> => {
        vault.injectPrimitive('Product');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let product = new Product(vault);

        expect(product.name).toEqual('Product');
        expect(product.container_type).toEqual('embedded_file');
        expect(product.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let product = new Product(vault);

        let productData = await product.getProduct(author);

        expect(productData.fields).toEqual({});
        expect(productData.documents).toEqual({});
    });

    describe(`fields`, async () => {

        it(`can be set`, async () => {
            let product = await injectPrimitive();

            await product.setFields(author, {
                name: 'product name',
            });
        });

        it(`can be retrieved`, async () => {
            let product = await injectPrimitive();
            await product.setFields(author, {
                name: 'product name',
            });

            product = await refreshPrimitive();

            let productFields = await product.getFields(author);
            expect(productFields.name).toEqual('product name');
        });
    });

    describe(`documents`, async () => {

        it(`needs valid linkEntry`, async () => {
            let product = await injectPrimitive();

            let caughtError;

            try {
                await product.addDocument(author, "docId", "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Document] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let product = await injectPrimitive();

            let caughtError;

            try {
                await product.getDocument(author, "unknownDoc");
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Document 'unknownDoc' not found in Product`);
        });

        it(`can add`, async () => {
            let product = await injectPrimitive();
            await product.addDocument(author, 'docId', getNockableLink('Document'));
        });

        it(`can be retrieved`, async () => {
            let product = await injectPrimitive();
            await product.addDocument(author, 'docId', getNockableLink('Document'));

            product = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');

            let document = await product.getDocument(author, 'docId');

            expect(document.fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(thisDocumentNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let product = await injectPrimitive();
            let list = await product.listDocuments(author);
            expect(list).toEqual([]);

            await product.addDocument(author, 'docId', getNockableLink('Document'));

            product = await refreshPrimitive();

            list = await product.listDocuments(author);

            expect(list).toEqual(['docId']);
        });
    });

    describe(`full primitive`, async () => {

        it(`can be retrieved`, async () => {
            let product = await injectPrimitive();
            await product.setFields(author, {
                name: 'product name',
            });
            await product.addDocument(author, 'docId', getNockableLink('Document'));

            product = await refreshPrimitive();

            const thisDocumentNock = nockLinkedData('Document');

            let fullProduct = await product.getProduct(author);

            expect(fullProduct.fields.name).toEqual('product name');
            expect(fullProduct.documents['docId'].fields.name).toEqual(getPrimitiveData('Document').fields.name);
            expect(thisDocumentNock.isDone()).toBeTruthy();
        });
    });

};
