/*
 * Copyright 2018 ShipChain, Inc.
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
import * as typeorm from "typeorm";
import { LoadVault } from '../LoadVault';
import { Wallet } from '../../entity/Wallet';
import { PrivateKeyDBFieldEncryption } from "../../entity/encryption/PrivateKeyDBFieldEncryption";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


describe('LoadVault', function() {
    const RealDate = Date;

    function mockDate(isoDate) {
        // @ts-ignore
        global.Date = class extends RealDate {
            constructor() {
                super();
                return new RealDate(isoDate);
            }
        };
    }

    function resetDate() {
        // @ts-ignore
        global.Date = RealDate;
    }

    beforeAll(async () => {
        // read connection options from ormconfig file (or ENV variables)
        const connectionOptions = await typeorm.getConnectionOptions();
        await typeorm.createConnection({
            ...connectionOptions,
        });

        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());
    });

    afterEach(async () => {
        resetDate();
    });

    it(`can be created`, async () => {
        let author = await Wallet.generate_entity();

        /* New vault shouldn't exist yet */
        let vault = new LoadVault(storage_driver);
        expect(await vault.metadataFileExists()).toBe(false);

        /* And then we can write the metadata */
        await vault.getOrCreateMetadata(author);
        expect(await vault.metadataFileExists()).toBe(true);

        /* And delete it to clean up */
        await vault.deleteEverything();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it('can add and retrieve Shipment data', async() => {
        let author: Wallet = await Wallet.generate_entity();

        /* New vault shouldn't exist yet */
        let vault = new LoadVault(storage_driver);
        await vault.getOrCreateMetadata(author);

        // Test with first set of Shipment fields
        await vault.addShipmentData(author, SHIPMENT_01);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        let testShipment = await vault.getShipmentData(author);

        expect(testShipment).toEqual(SHIPMENT_01);

        // Test with another set of Shipment fields
        await vault.addShipmentData(author, SHIPMENT_02);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        testShipment = await vault.getShipmentData(author);

        expect(testShipment).toEqual(SHIPMENT_02);
    });

    it('can add and retrieve Tracking data', async() => {
        let author: Wallet = await Wallet.generate_entity();

        /* New vault shouldn't exist yet */
        let vault = new LoadVault(storage_driver);
        await vault.getOrCreateMetadata(author);

        // Test with a single point
        await vault.addTrackingData(author, TRACKING_01);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        let testTracking = await vault.getTrackingData(author);

        expect(testTracking).toEqual([TRACKING_01]);

        // Test with another point
        await vault.addTrackingData(author, TRACKING_02);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        testTracking = await vault.getTrackingData(author);

        expect(testTracking).toEqual([TRACKING_01, TRACKING_02]);
    });

    it('can add and retrieve Documents', async() => {
        let author: Wallet = await Wallet.generate_entity();

        /* New vault shouldn't exist yet */
        let vault = new LoadVault(storage_driver);
        await vault.getOrCreateMetadata(author);

        // Test with first Document
        await vault.addDocument(author, DOCUMENT_01.name, DOCUMENT_01.content);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        let testDocument = await vault.getDocument(author, DOCUMENT_01.name);

        expect(testDocument).toEqual(DOCUMENT_01.content);

        // Test with another Document
        await vault.addDocument(author, DOCUMENT_02.name, DOCUMENT_02.content);
        await vault.writeMetadata(author);

        vault = new LoadVault(storage_driver, vault.id);
        testDocument = await vault.getDocument(author, DOCUMENT_02.name);

        expect(testDocument).toEqual(DOCUMENT_02.content);

        // List created Documents
        let listing = await vault.listDocuments();
        expect(listing).toEqual([{name: DOCUMENT_01.name},{name: DOCUMENT_02.name}]);
    });

});


const SHIPMENT_01 = {
    id: "14D6A86b-b52e-4CBE-93AE-CEA5bA90fAcb",
    carrier_scac: "F49S",
    customer_fields: {
        u: "wot",
        i: "swear on me"
    }
};
const SHIPMENT_02 = {
    id: "19ef431c-3b09-4df1-9faf-673951a602ab",
    carrier_scac: "G50T"
};

const TRACKING_01 = {tracking: 1};
const TRACKING_02 = {tracking: 2};

const DOCUMENT_01 = {
    name: 'file01.txt',
    content: 'test file content 1'
};
const DOCUMENT_02 = {
    name: 'file02.png',
    content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mN8U+T4nYEIwDiqkL4KAZKnGefMCAbPAAAAAElFTkSuQmCC'
};
