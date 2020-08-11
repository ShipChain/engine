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
import { DocumentList } from "../vaults/primitives/DocumentList";
import { DocumentProperties } from "../vaults/primitives/Document";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

import { getNockableLink, getPrimitiveData, nockLinkedData } from "./utils";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const DocumentListPrimitiveTests = function() {
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

    let refreshPrimitive = async(): Promise<DocumentList> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('DocumentList');
    };

    let injectPrimitive = async (): Promise<DocumentList> => {
        vault.injectPrimitive('DocumentList');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let documentList = new DocumentList(vault);

        expect(documentList.name).toEqual('DocumentList');
        expect(documentList.container_type).toEqual('link');
        expect(documentList.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let documentList = new DocumentList(vault);

        expect(documentList.count()).toEqual(0);
        expect(documentList.list()).toEqual([]);
    });

    it(`throws if retrieving unknown linkId`, async () => {
        let documentList = await injectPrimitive();

        let caughtError;

        try {
            await documentList.getEntity('unknownLink');
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`LinkID [unknownLink] not found!`);
    });

    it(`throws if adding invalid linkEntry`, async () => {
        let documentList = await injectPrimitive();

        let caughtError;

        try {
            await documentList.addEntity(author, 'badLink', RemoteVault.buildLinkEntry(getNockableLink('Product')));
            fail(`Should have thrown`);
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Expecting Link to [Document] instead received [Product]`);
    });

    it(`adds valid linkEntry`, async () => {
        let documentList = await injectPrimitive();
        await documentList.addEntity(author, 'docId', RemoteVault.buildLinkEntry(getNockableLink('Document')));
    });

    it(`can return valid linkEntry`, async () => {
        let documentList = await injectPrimitive();
        await documentList.addEntity(author, 'docId', RemoteVault.buildLinkEntry(getNockableLink('Document')));

        documentList = await refreshPrimitive();

        const thisDocumentNock = nockLinkedData('Document');

        let fullDocument = await documentList.getEntity('docId') as DocumentProperties;

        expect(fullDocument.fields.name).toEqual(getPrimitiveData('Document').fields.name);

        expect(thisDocumentNock.isDone()).toBeTruthy();
    });

    it(`can list`, async () => {
        let documentList = await injectPrimitive();
        await documentList.addEntity(author, 'docId', RemoteVault.buildLinkEntry(getNockableLink('Document')));
        await documentList.addEntity(author, 'docId2', RemoteVault.buildLinkEntry(getNockableLink('Document')));

        documentList = await refreshPrimitive();

        let list = await documentList.list();

        expect(list.length).toEqual(2);
        expect(list[0]).toEqual('docId');
        expect(list[1]).toEqual('docId2');
    });

};
