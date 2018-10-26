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

const metrics = MetricsReporter.Instance;

const ENV = process.env.ENV || 'LOCAL';

const driverType = ['s3', 'sftp', 'local'];

@RPCNamespace({ name: 'StorageCredentials' })
export class RPCStorageCredentials {
    @RPCMethod({ require: ['title', 'driver_type'] })
    public static async Create(args) {

        // Local driver type is disabled in environment other than LOCAL
        // and storage credentials creation is disabled for unrecognizable driver type
        const notAllowedStorage = (ENV != 'LOCAL' && args.driver_type === 'local') || driverType.indexOf(args.driver_type) < 0;
        if (notAllowedStorage){
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
}
