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
import * as typeorm from "typeorm";
import { StorageCredential } from '../entity/StorageCredential';
import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';

export const StorageCredentialEntityTests = function() {

    it(`can create and retrieve storage credentials`, async () => {
        const DB = typeorm.getConnection();
        const Credentials = DB.getRepository(StorageCredential);
        const attrs = {
            title: 'My Driver',
            driver_type: 'local',
            base_path: './storage/credential-test',
            options: { foo: 'bar' },
        };

        const credential = await StorageCredential.generate_entity(attrs);

        await Credentials.save(credential);

        expect(credential.id).toHaveLength(36);

        const options_from_id = await StorageCredential.getOptionsById(credential.id);

        expect(await credential.getDriverOptions()).toEqual(options_from_id);
    });

    it(`can update storage credentials`, async () => {
        const attrs = {
            title: 'My Driver',
            driver_type: 'local',
            base_path: './storage/credential-test',
            options: { foo: 'bar' },
        };

        const newTitle = "New Title";
        const newOptions = {setting: "New!"};

        const credential = await StorageCredential.generate_entity(attrs);
        await credential.save();

        // Update Title
        await credential.update(newTitle);
        expect(credential.title).toEqual(newTitle);

        const oldOptions = JSON.parse(await EncryptorContainer.defaultEncryptor.decrypt(credential.options['EncryptedJson']));
        expect(oldOptions).toEqual(attrs.options);

        // Update Options
        await credential.update(null, newOptions);
        expect(credential.title).toEqual(newTitle);
        const unEncyptedOptions = JSON.parse(await EncryptorContainer.defaultEncryptor.decrypt(credential.options['EncryptedJson']));
        expect(unEncyptedOptions).toEqual(newOptions);
    });
};
