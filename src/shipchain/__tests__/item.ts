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
import { Item } from "../vaults/primitives/Item";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };

const nock = require('nock');
const nockedUrl = 'http://nocked-url:2000';
const nockedResponse = {
    'jsonrpc': '2.0',
    'result': '{"fields":{"name":"Remote Product"},"documents":{}}',
    'id': 0,
};
const validProductLink = `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/Product`;


export const ItemPrimitiveTests = async function() {
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

    let injectPrimitive = async (): Promise<Item> => {
        vault.injectPrimitive('Item');
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Item');
    };

    it(`can be created`, async () => {
        let item = new Item(vault);

        expect(item.name).toEqual('Item');
        expect(item.container_type).toEqual('embedded_file');
        expect(item.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let item = new Item(vault);

        let itemData = await item.getItem(author);

        expect(itemData.fields).toEqual({});
        expect(itemData.product).toBeNull();
    });

    describe(`fields`, async () => {

        it(`can be set`, async () => {
            let item = await injectPrimitive();

            await item.setFields(author, {
                serial_number: 'serial #',
            });
        });

        it(`can be retrieved`, async () => {
            let item = await injectPrimitive();
            await item.setFields(author, {
                serial_number: 'serial #',
            });

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            let itemFields = await item.getFields(author);
            expect(itemFields.serial_number).toEqual('serial #');
        });
    });

    describe(`product`, async () => {

        it(`needs valid linkEntry`, async () => {
            let item = await injectPrimitive();

            let caughtError;

            try {
                await item.setProduct(author, "not a linkEntry");
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Expecting Link to [Product] instead received [invalid linkEntry]`);
        });

        it(`throws if retrieved when not set`, async () => {
            let item = await injectPrimitive();

            let caughtError;

            try {
                await item.getProduct(author);
                fail(`Should have thrown`);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Product not found in Item`);
        });

        it(`can be set`, async () => {
            let item = await injectPrimitive();
            await item.setProduct(author, validProductLink);
        });

        it(`can be retrieved`, async () => {
            let item = await injectPrimitive();
            await item.setProduct(author, validProductLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedResponse);

            let product = await item.getProduct(author);
            expect(product.fields.name).toEqual('Remote Product');
            expect(thisNock.isDone()).toBeTruthy();
        });
    });

    describe(`full primitive`, async () => {

        it(`can be retrieved`, async () => {
            let item = await injectPrimitive();
            await item.setFields(author, {
                serial_number: 'serial #',
            });
            await item.setProduct(author, validProductLink);

            await vault.writeMetadata(author);
            await vault.loadMetadata();

            const thisNock = nock(nockedUrl)
                .post('', (body) => {
                    return body.method === 'vaults.linked.get_linked_data';
                }).reply(200, nockedResponse);

            let product = await item.getProduct(author);
            expect(product.fields.name).toEqual('Remote Product');
            expect(thisNock.isDone()).toBeTruthy();
        });
    });

};
