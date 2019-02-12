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

import { RPCMethod, RPCNamespace } from './decorators';
import { StorageCredential } from '../src/entity/StorageCredential';
import { MetricsReporter } from '../src/MetricsReporter';
import * as path from 'path';
import { StorageDriverFactory } from '../src/storage/StorageDriverFactory';

const metrics = MetricsReporter.Instance;

const ENV = process.env.ENV || 'LOCAL';

const driverType = ['s3', 'sftp', 'local'];

@RPCNamespace({ name: 'StorageCredentials' })
export class RPCStorageCredentials {
    @RPCMethod({ require: ['title', 'driver_type'] })
    public static async Create(args) {
        // Local driver type is disabled in environment other than LOCAL
        // and storage credentials creation is disabled for unrecognizable driver type
        if ((ENV != 'LOCAL' && args.driver_type === 'local') || driverType.indexOf(args.driver_type) < 0) {
            throw new Error(`Driver type: ${args.driver_type}, not allowed!`);
        }

        const credentials = StorageCredential.generate_entity(args);

        await credentials.save();

        // This should be non-blocking
        StorageCredential.getCount()
            .then(count => {
                metrics.entityTotal('StorageCredential', count);
            })
            .catch(err => {});

        return {
            success: true,
            credentials: {
                id: credentials.id,
                title: credentials.title,
                driver_type: credentials.driver_type,
                base_path: credentials.base_path,
            },
        };
    }

    @RPCMethod()
    public static async List() {
        const storageCredentials: StorageCredential[] = await StorageCredential.listAll();

        return {
            success: true,
            credentials: storageCredentials,
        };
    }

    @RPCMethod({
        require: ['storageCredentials'],
        validate: {
            uuid: ['storageCredentials'],
        },
    })
    public static async TestConnectivity(args) {
        const testDirectory = `TestConnectivity_${new Date().getTime()}`;
        const testFileName = 'TestConnectivity.txt';
        const testContent = 'Hello, World! Привет мир! 你好，世界！';

        let valid: boolean;
        let message: string = undefined;

        try {
            const testOptions = await StorageCredential.getOptionsById(args.storageCredentials);

            const auth = {
                ...testOptions,
                base_path: path.join(testOptions.base_path || './', testDirectory),
            };

            const driver = StorageDriverFactory.create(auth);
            await driver.putFile(testFileName, testContent);

            if (!(await driver.fileExists(testFileName))) {
                throw new Error('Created file does not exist');
            }

            const retrievedContent = await driver.getFile(testFileName);
            if (retrievedContent != testContent) {
                throw new Error('Stored content does not match retrieved content');
            }

            await driver.removeDirectory(null, true);

            valid = true;
        } catch (err) {
            valid = false;

            if (err.message) {
                message = err.message;
            } else {
                message = err;
            }
        }

        return {
            valid: valid,
            message,
        };
    }

    @RPCMethod({
        require: ['storageCredentials'],
        validate: {
            uuid: ['storageCredentials'],
        },
    })
    public static async Update(args) {
        const storage = await StorageCredential.getById(args.storageCredentials);

        await storage.update(args.title, args.options);

        return {
            updated: true,
        };
    }
}
