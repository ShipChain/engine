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

require('./testLoggingConfig');

import 'mocha';
import { createConnection } from 'typeorm';
import { Vault } from '../vaults/Vault';
import { Wallet } from '../entity/Wallet';
import { PrivateKeyDBFieldEncryption } from "../encryption/PrivateKeyDBFieldEncryption";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };
const CONTAINER = 'test2';
const FILE_1 = "file01.txt";
const FILE_2 = "file02.txt";
const DATE_0 = '2018-01-01T01:00:00.000Z';
const DATE_1 = '2018-01-01T01:00:01.000Z';
const DATE_2 = '2018-01-01T01:00:02.000Z';
const DATE_3 = '2018-01-01T01:00:03.000Z';
const DATE_4 = '2018-01-01T01:00:04.000Z';
const DATE_5 = '2018-01-01T01:00:05.000Z';

describe('Vaults', function() {
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

    async function writeAndReopen(author, storage_driver, date, vault, type, containerName = CONTAINER){
        mockDate(date);
        await vault.writeMetadata(author);

        const new_vault = new Vault(storage_driver, vault.id);
        await new_vault.loadMetadata();
        const container = new_vault.getOrCreateContainer(author, containerName, type);

        return [new_vault, container];
    }

    beforeEach(async () => {
        this.connection = await createConnection({
            type: 'sqljs',
            synchronize: true,
            entities: ['src/entity/**/*.ts'],
        });

        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());
    });

    afterEach(async () => {
        await this.connection.dropDatabase();
        if (this.connection.isConnected) {
            await this.connection.close();
        }
        global.Date = RealDate;
    });

    it(`can create or load an empty vault`, async () => {
        let author = await Wallet.generate_entity();

        /* New vault shouldn't exist yet */
        let vault = new Vault(storage_driver);
        expect(await vault.metadataFileExists()).toBe(false);

        /* And then we can write the metadata */
        await vault.getOrCreateMetadata(author);
        expect(await vault.metadataFileExists()).toBe(true);

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`can validate a vault`, async () => {
        class TestVault extends Vault {
            changeSignatureTime() {
                this.meta.signed.at = new Date();
            }
        }

        let author = await Wallet.generate_entity();

        /* New vault should verify with cryptographic signatures */
        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);
        expect(await vault.verify()).toBe(true);

        /* If we make a new vault with the same id ... */
        let new_vault = new TestVault(storage_driver, vault.id);
        await new_vault.getOrCreateMetadata(author);

        /* then it exists and is the same */
        expect(vault.metadataHash()).toBe(new_vault.metadataHash());
        expect(await new_vault.verify()).toBe(true);

        /* and modifying the signature date invalidates it */
        new_vault.changeSignatureTime();
        expect(await new_vault.verify()).toBe(false);

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`creates an ownership key`, async () => {
        let author = await Wallet.generate_entity();
        let stranger = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        expect(await vault.createRole(author, Vault.OWNERS_ROLE)).toBe(false);

        expect(vault.authorized_for_role(author.public_key, Vault.OWNERS_ROLE)).toBe(true);
        expect(vault.authorized_for_role(stranger.public_key, Vault.OWNERS_ROLE)).toBe(false);

        /* Anyone should be able to sign messages for owners */
        const encrypted = (await vault.encryptForRole(Vault.OWNERS_ROLE, 'TeST')).to_string;

        /* Only Author be able to read messages for owners */
        expect(await vault.decryptMessage(author, encrypted)).toBe('TeST');

        /* This stranger can't authorize himself... */
        expect(await vault.authorize(stranger, Vault.OWNERS_ROLE, stranger.public_key)).toBe(false);
        expect(vault.authorized_for_role(stranger.public_key, Vault.OWNERS_ROLE)).toBe(false);
        try {
            await vault.decryptMessage(stranger, encrypted);
            fail('Should not have decrypted message');
        } catch (_err) {
            expect(_err).toEqual(new Error('Wallet has no access to contents'));
        }

        /* But if the author lets him in... */
        expect(await vault.authorize(author, Vault.OWNERS_ROLE, stranger.public_key)).toBe(true);
        expect(vault.authorized_for_role(stranger.public_key, Vault.OWNERS_ROLE)).toBe(true);

        /* He can read the data! */
        expect(await vault.decryptMessage(stranger, encrypted)).toBe('TeST');

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`can properly create/read empty embedded file containers`, async () => {
        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        vault.getOrCreateContainer(author, 'embedded_file', 'embedded_file');

        await vault.writeMetadata(author);
        expect(await vault.verify()).toBe(true);

        const re_open = new Vault(storage_driver, vault.id);
        await re_open.loadMetadata();
        expect(await re_open.verify()).toBe(true);

        const re_open_container = re_open.getOrCreateContainer(author, 'embedded_file', 'embedded_file');

        try {
            await re_open_container.decryptContents(author);
            fail('Should not have decrypted empty embedded file');
        } catch (_err) {
            expect(_err).toEqual(new Error('Container contents empty'));
        }
    });

    it(`can properly create/read empty embedded list containers`, async () => {
        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        vault.getOrCreateContainer(author, 'embedded_list', 'embedded_list');

        await vault.writeMetadata(author);
        expect(await vault.verify()).toBe(true);

        const re_open = new Vault(storage_driver, vault.id);
        await re_open.loadMetadata();
        expect(await re_open.verify()).toBe(true);

        const re_open_container = re_open.getOrCreateContainer(author, 'embedded_list', 'embedded_list');

        expect(await re_open_container.decryptContents(author)).toEqual([]);
    });

    it(`can properly create/read empty external file containers`, async () => {
        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        vault.getOrCreateContainer(author, 'external_file', 'external_file');

        await vault.writeMetadata(author);
        expect(await vault.verify()).toBe(true);

        const re_open = new Vault(storage_driver, vault.id);
        await re_open.loadMetadata();
        expect(await re_open.verify()).toBe(true);

        const re_open_container = re_open.getOrCreateContainer(author, 'external_file', 'external_file');

        try {
            await re_open_container.decryptContents(author);
            fail('Should not have decrypted empty external file');
        } catch (_err) {
            expect(_err).toEqual(new Error('Container contents empty'));
        }
    });

    it(`can properly create/read empty external list containers`, async () => {
        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        vault.getOrCreateContainer(author, 'external_list', 'external_list');

        await vault.writeMetadata(author);
        expect(await vault.verify()).toBe(true);

        const re_open = new Vault(storage_driver, vault.id);
        await re_open.loadMetadata();
        expect(await re_open.verify()).toBe(true);

        const re_open_container = re_open.getOrCreateContainer(author, 'external_list', 'external_list');

        expect(await re_open_container.decryptContents(author)).toEqual([]);
    });

    it(`can add a file container`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);
        const container = vault.getOrCreateContainer(author, 'file_01.txt');

        await container.setContents(author, 'TEST EMBED');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        expect(await container.decryptContents(author)).toBe('TEST EMBED');

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`can append to a container`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);
        const container = vault.getOrCreateContainer(author, 'tracking', 'embedded_list');

        await container.append(author, 'one');
        await container.append(author, 'two');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        const re_open = new Vault(storage_driver, vault.id);

        await re_open.loadMetadata();

        expect(await re_open.verify()).toBe(true);

        const re_open_tracking = re_open.getOrCreateContainer(author, 'tracking', 'embedded_list');

        expect(await re_open_tracking.decryptContents(author)).toEqual(['one', 'two']);
    });

    it(`can add an external file container`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);
        const container = vault.getOrCreateContainer(author, 'test_external', 'external_file');

        await container.setContents(author, 'TEST External');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        expect(await container.decryptContents(author)).toBe('TEST External');

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`can add an external multi file container`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);
        const container = vault.getOrCreateContainer(author, 'test_external_file_multi', 'external_file_multi');

        await container.setSingleContent(author, 'file_01.txt', 'TEST External 1');
        await container.setSingleContent(author, 'file_02.txt', 'TEST External 2');

        expect(await vault.fileExists('test_external_file_multi/file_01.txt.json')).toBeFalsy();
        expect(await vault.fileExists('test_external_file_multi/file_02.txt.json')).toBeFalsy();

        await vault.writeMetadata(author);

        expect(await container.listFiles()).toEqual([
            {"name": "file_01.txt"},
            {"name": "file_02.txt"},
        ]);

        expect(await vault.verify()).toBe(true);

        expect(await vault.fileExists('test_external_file_multi/file_01.txt.json')).toBeTruthy();
        expect(await vault.fileExists('test_external_file_multi/file_02.txt.json')).toBeTruthy();

        expect(await container.decryptContents(author, 'file_01.txt')).toBe('TEST External 1');
        expect(await container.decryptContents(author, 'file_02.txt')).toBe('TEST External 2');

        /* And delete it to clean up */
        await vault.deleteMetadata();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`can append to an external container`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        expect(await vault.fileExists('meta.json')).toBeTruthy();

        const container = vault.getOrCreateContainer(author, 'tracking_external', 'external_list');

        expect(await vault.fileExists('tracking_external.json')).toBeFalsy();

        await container.append(author, 'one');
        await container.append(author, 'two');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        expect(await vault.fileExists('tracking_external.json')).toBeTruthy();

        const re_open = new Vault(storage_driver, vault.id);

        await re_open.loadMetadata();

        expect(await re_open.verify()).toBe(true);

        const re_open_tracking = re_open.getOrCreateContainer(author, 'tracking_external', 'external_list');

        expect(await re_open_tracking.decryptContents(author)).toEqual(['one', 'two']);
    });

    it(`can append to an external daily container`, async () => {
        let author = await Wallet.generate_entity();

        // Initialize to the 1st
        mockDate('2018-01-01');

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        expect(await vault.fileExists('meta.json')).toBeTruthy();

        const container = vault.getOrCreateContainer(author, 'tracking_external_daily', 'external_list_daily');

        expect(await vault.fileExists('tracking_external_daily/20180101.json')).toBeFalsy();
        expect(await vault.fileExists('tracking_external_daily/20180102.json')).toBeFalsy();

        await container.append(author, 'one');

        // Put the second data point in the 2nd day's list
        mockDate('2018-01-02');
        await container.append(author, 'two');
        await container.append(author, 'two-two');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        expect(await vault.fileExists('tracking_external_daily/20180101.json')).toBeTruthy();
        expect(await vault.fileExists('tracking_external_daily/20180102.json')).toBeTruthy();

        const vault_2 = new Vault(storage_driver, vault.id);

        const vault_2_meta = await vault_2.loadMetadata();

        expect(await vault_2.verify()).toBe(true);

        const vault_2_tracking = vault_2.getOrCreateContainer(author, 'tracking_external_daily', 'external_list_daily');

        expect(vault_2_meta.signed.at).toEqual('2018-01-02T00:00:00.000Z');
        expect(vault_2_meta.containers.tracking_external_daily['tracking_external_daily/20180101.json'].at).toEqual(
            '2018-01-02T00:00:00.000Z',
        );
        expect(vault_2_meta.containers.tracking_external_daily['tracking_external_daily/20180102.json'].at).toEqual(
            '2018-01-02T00:00:00.000Z',
        );

        expect(await vault_2_tracking.decryptContents(author)).toEqual(['one', 'two', 'two-two']);

        // Append to the 2nd day's list
        await vault_2_tracking.append(author, 'three');

        mockDate('2018-01-03');
        await vault_2.writeMetadata(author);

        expect(await vault_2.verify()).toBe(true);

        const vault_3 = new Vault(storage_driver, vault.id);

        const vault_3_meta = await vault_3.loadMetadata();

        expect(await vault_3.verify()).toBe(true);

        const vault_3_tracking = vault_3.getOrCreateContainer(author, 'tracking_external_daily', 'external_list_daily');

        expect(await vault_3_tracking.decryptContents(author)).toEqual(['one', 'two', 'two-two', 'three']);

        expect(vault_3_meta.signed.at).toEqual('2018-01-03T00:00:00.000Z');
        expect(vault_3_meta.containers.tracking_external_daily['tracking_external_daily/20180101.json'].at).toEqual(
            '2018-01-02T00:00:00.000Z',
        );
        expect(vault_3_meta.containers.tracking_external_daily['tracking_external_daily/20180102.json'].at).toEqual(
            '2018-01-03T00:00:00.000Z',
        );
    });

    it(`retains non-modified container data`, async () => {
        let author = await Wallet.generate_entity();

        let vault = new Vault(storage_driver);
        await vault.getOrCreateMetadata(author);

        const container_types = {
            file: ['embedded_file', 'external_file'],
            list: ['embedded_list', 'external_list', 'external_list_daily'],
            fileMulti: ['external_file_multi'],
        };

        let container_refs = {};

        // Create all containers
        for (let type of [...container_types.file, ...container_types.list, ...container_types.fileMulti]){
            container_refs[type] = vault.getOrCreateContainer(author, type, type);
        }

        // Set contents of File containers
        for (let type of container_types.file){
            await container_refs[type].setContents(author, type);
        }

        // Append type to List containers
        for (let type of container_types.list){
            await container_refs[type].append(author, type);
        }

        // Set single content of Multi File containers
        for (let type of container_types.fileMulti){
            await container_refs[type].setSingleContent(author, type, type);
        }

        // Write out the contents of all containers
        await vault.writeMetadata(author);
        expect(await vault.verify()).toBe(true);

        const original_vault_id = vault.id;
        vault = null;

        // Reopen the vault
        let re_open = new Vault(storage_driver, original_vault_id);
        await re_open.loadMetadata();
        expect(await re_open.verify()).toBe(true);

        container_refs = {};

        for (let type of [...container_types.file, ...container_types.list, ...container_types.fileMulti]){
            container_refs[type] = re_open.getOrCreateContainer(author, type, type);
        }

        // Set the contents of a single container
        let test_container = re_open.getOrCreateContainer(author, 'test_container', 'embedded_file');
        await test_container.setContents(author, 'test_container');

        // Write out the changed content
        await re_open.writeMetadata(author);
        expect(await re_open.verify()).toBe(true);

        // Reopen the vault
        re_open = new Vault(storage_driver, original_vault_id);
        await re_open.loadMetadata();

        container_refs = {};

        for (let type of [...container_types.file, ...container_types.list, ...container_types.fileMulti]){
            container_refs[type] = re_open.getOrCreateContainer(author, type, type);
        }

        // Test the contents of all existing containers
        test_container = re_open.getOrCreateContainer(author, 'test_container', 'embedded_file');
        expect(await test_container.decryptContents(author)).toEqual('test_container');

        for (let type of container_types.file){
            expect(await container_refs[type].decryptContents(author)).toEqual(type)
        }

        for (let type of container_types.list){
            expect(await container_refs[type].decryptContents(author)).toEqual([type])
        }

        for (let type of container_types.fileMulti){
            expect(await container_refs[type].decryptContents(author, type)).toEqual(type)
        }
    });

    it('Check the vault uri', async () => {
        let storageWithId = {
            ...storage_driver,
            __id: '123ABCxyz',
            id: 'my-Custom-Id-123'
        };
        let vault = new Vault(storageWithId, storageWithId.id);

        let uri = vault.getVaultMetaFileUri();
        let arrayUri = uri.split('/');

        expect(arrayUri[2]).toEqual(storageWithId.__id);
        expect(arrayUri[3]).toEqual(storageWithId.id);
    });

    it(`can view historical Embedded List content`, async () => {
        const type = 'embedded_list';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type);

        await container.append(author, {minute: 2});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type);

        await container.append(author, {minute: 4});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author);
        expect(test_0).toEqual([{minute: 2}, {minute: 4}]);

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1);
            fail(`Should not have historical data for ${DATE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3);
        expect(test_1[CONTAINER]).toEqual([{minute: 2}]);

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_5);
        expect(test_2[CONTAINER]).toEqual([{minute: 2}, {minute: 4}]);
    });

    it(`can view historical External List content`, async () => {
        const type = 'external_list';

        let CONTAINER = 'test';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type, CONTAINER);

        await container.append(author, {minute: 2});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type, CONTAINER);

        await container.append(author, {minute: 4});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type, CONTAINER);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author);
        expect(test_0).toEqual([{minute: 2}, {minute: 4}]);

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1);
            fail(`Should not have historical data for ${DATE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3);
        expect(test_1[CONTAINER]).toEqual([{minute: 2}]);

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_5);
        expect(test_2[CONTAINER]).toEqual([{minute: 2}, {minute: 4}]);
    });

    it(`can view historical External List Daily content`, async () => {
        const type = 'external_list_daily';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type);

        mockDate(DATE_2);
        await container.append(author, {minute: 2});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type);

        mockDate(DATE_4);
        await container.append(author, {minute: 4});

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author);
        expect(test_0).toEqual([{minute: 2}, {minute: 4}]);

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1);
            fail(`Should not have historical data for ${DATE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3);
        expect(test_1[CONTAINER]).toEqual([{minute: 2}]);

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_5);
        expect(test_2[CONTAINER]).toEqual([{minute: 2}, {minute: 4}]);
    });

    it(`can view historical Embedded File content`, async () => {
        const type = 'embedded_file';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type);

        await container.setContents(author, "2");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type);

        await container.setContents(author, "4");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author);
        expect(test_0).toEqual("4");

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1);
            fail(`Should not have historical data for ${DATE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3);
        expect(test_1[CONTAINER]).toEqual("2");

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_5);
        expect(test_2[CONTAINER]).toEqual("4");
    });

    it(`can view historical External File content`, async () => {
        const type = 'external_file';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type);

        await container.setContents(author, "2");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type);

        await container.setContents(author, "4");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author);
        expect(test_0).toEqual("4");

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1);
            fail(`Should not have historical data for ${DATE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3);
        expect(test_1[CONTAINER]).toEqual("2");

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_5);
        expect(test_2[CONTAINER]).toEqual("4");
    });

    it(`can view historical External File Multi content`, async () => {
        const type = 'external_file_multi';

        let author = await Wallet.generate_entity();
        let vault = new Vault(storage_driver);
        let container;
        await vault.getOrCreateMetadata(author);
        vault.getOrCreateContainer(author, CONTAINER, type);

        [vault, container] = await writeAndReopen(author, storage_driver, DATE_0, vault, type);

        await container.setSingleContent(author, FILE_1, "1-2");
        await container.setSingleContent(author, FILE_2, "2-2");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_2, vault, type);

        await container.setSingleContent(author, FILE_1, "1-4");
        await container.setSingleContent(author, FILE_2, "2-4");

        // Write and ReOpen to solidify signature times
        [vault, container] = await writeAndReopen(author, storage_driver, DATE_4, vault, type);

        expect(await vault.verify()).toBe(true);

        resetDate();

        let test_0 = await container.decryptContents(author, FILE_1);
        expect(test_0).toEqual("1-4");

        test_0 = await container.decryptContents(author, FILE_2);
        expect(test_0).toEqual("2-4");

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1, FILE_1);
            fail(`Should not have historical data for ${DATE_1} ${FILE_1}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        try {
            let failure = await vault.getHistoricalData(author, CONTAINER, DATE_1, FILE_2);
            fail(`Should not have historical data for ${DATE_1} ${FILE_2}: '${JSON.stringify(failure)}'`);
        } catch(err){}

        let test_1 = await vault.getHistoricalData(author, CONTAINER, DATE_3, FILE_1);
        expect(test_1[CONTAINER][FILE_1]).toEqual("1-2");

        let test_2 = await vault.getHistoricalData(author, CONTAINER, DATE_3, FILE_2);
        expect(test_2[CONTAINER][FILE_2]).toEqual("2-2");

        let test_3 = await vault.getHistoricalData(author, CONTAINER, DATE_5, FILE_1);
        expect(test_3[CONTAINER][FILE_1]).toEqual("1-4");

        let test_4 = await vault.getHistoricalData(author, CONTAINER, DATE_5, FILE_2);
        expect(test_4[CONTAINER][FILE_2]).toEqual("2-4");
    });

});
