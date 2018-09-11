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

        expect(await vault.createRole(author, 'owners')).toBe(false);

        expect(vault.authorized_for_role(author.public_key, 'owners')).toBe(true);
        expect(vault.authorized_for_role(stranger.public_key, 'owners')).toBe(false);

        /* Anyone should be able to sign messages for owners */
        const encrypted = (await vault.encryptForRole('owners', 'TeST')).to_string;

        /* Only Author be able to read messages for owners */
        expect(await vault.decryptMessage(author, encrypted)).toBe('TeST');

        /* This stranger can't authorize himself... */
        expect(await vault.authorize(stranger, 'owners', stranger.public_key)).toBe(false);
        expect(vault.authorized_for_role(stranger.public_key, 'owners')).toBe(false);
        try {
            await vault.decryptMessage(stranger, encrypted);
            fail('Should not have decrypted message');
        } catch (_err) {
            expect(_err).toEqual(new Error('Wallet has no access to contents'));
        }

        /* But if the author lets him in... */
        expect(await vault.authorize(author, 'owners', stranger.public_key)).toBe(true);
        expect(vault.authorized_for_role(stranger.public_key, 'owners')).toBe(true);

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

        container.setContents(author, 'TEST EMBED');

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

        container.setContents(author, 'TEST External');

        await vault.writeMetadata(author);

        expect(await vault.verify()).toBe(true);

        expect(await container.decryptContents(author)).toBe('TEST External');

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
            list: ['embedded_list', 'external_list', 'external_list_daily']
        };

        let container_refs = {};

        // Create all containers
        for (let type of [...container_types.file, ...container_types.list]){
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

        for (let type of [...container_types.file, ...container_types.list]){
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

        for (let type of [...container_types.file, ...container_types.list]){
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
    });
});
