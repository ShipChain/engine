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
import { Document } from "../vaults/primitives/Document";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const DocumentPrimitiveTests = async function() {
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

    let refreshPrimitive = async(): Promise<Document> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Document');
    };

    let injectPrimitive = async (): Promise<Document> => {
        vault.injectPrimitive('Document');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let document = new Document(vault);

        expect(document.name).toEqual('Document');
        expect(document.container_type).toEqual('embedded_file');
        expect(document.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let document = new Document(vault);

        let documentData = await document.getDocument(author);

        expect(documentData.fields).toEqual({});
        expect(documentData.content).toBeNull();
    });

    describe(`fields`, async () => {
        it(`can be set`, async () => {
            let document = await injectPrimitive();

            await document.setFields(author, {
                name: 'document name',
                description: 'document description',
            });
        });
        it(`can be retrieved`, async () => {
            let document = await injectPrimitive();
            await document.setFields(author, {
                name: 'document name',
                description: 'document description',
            });

            document = await refreshPrimitive();

            let documentFields = await document.getFields(author);
            expect(documentFields.name).toEqual('document name');
            expect(documentFields.description).toEqual('document description');
        });
    });

    describe(`contents`, async () => {
        it(`can be set`, async () => {
            let document = await injectPrimitive();

            await document.setContent(author, "document content");
        });
        it(`can be retrieved`, async () => {
            let document = await injectPrimitive();
            await document.setContent(author, "document content");

            document = await refreshPrimitive();

            let documentContent = await document.getContent(author);
            expect(documentContent).toEqual('document content');
        });
    });

    describe(`full primitive`, async () => {
        it(`can be set`, async () => {
            let document = await injectPrimitive();

            await document.setDocument(author, {
                name: 'document name',
                description: 'document description',
            }, 'document content');
        });
        it(`can be retrieved`, async () => {
            let document = await injectPrimitive();
            await document.setDocument(author, {
                name: 'document name',
                description: 'document description',
            }, 'document content');

            document = await refreshPrimitive();

            let fullDocument = await document.getDocument(author);

            expect(fullDocument.fields.name).toEqual('document name');
            expect(fullDocument.fields.description).toEqual('document description');
            expect(fullDocument.content).toEqual('document content');
        });
    });

};
