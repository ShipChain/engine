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

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };

const nock = require('nock');
const nockedUrl = 'http://nocked-url:2000';
const nockedResponse = {
    'jsonrpc': '2.0',
    'result': '{"fields":{"name":"Remote Document"},"content": null}',
    'id': 0,
};
const validDocumentLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Document`;


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

    let injectPrimitive = async (): Promise<Product> => {
        vault.injectPrimitive('Product');
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Product');
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

            await vault.writeMetadata(author);
            await vault.loadMetadata();

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
            await product.addDocument(author, 'docId', validDocumentLink);
        });

        it(`can be retrieved`, async () => {
            let product = await injectPrimitive();
            await product.addDocument(author, 'docId', validDocumentLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedResponse);

            let document = await product.getDocument(author, 'docId');
            expect(document.fields.name).toEqual('Remote Document');
            expect(thisNock.isDone()).toBeTruthy();
        });

        it(`can list`, async () => {
            let product = await injectPrimitive();
            let list = await product.listDocuments(author);
            expect(list).toEqual([]);

            await product.addDocument(author, 'docId', validDocumentLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

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
            await product.addDocument(author, 'docId', validDocumentLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedResponse);

            let document = await product.getDocument(author, 'docId');
            expect(document.fields.name).toEqual('Remote Document');
            expect(thisNock.isDone()).toBeTruthy();
        });
    });

};
