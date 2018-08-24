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

import { StorageDriver } from './StorageDriver';

import { S3StorageDriver } from './drivers/S3StorageDriver';
import { SftpStorageDriver } from './drivers/SftpStorageDriver';
import { LocalStorageDriver } from './drivers/LocalStorageDriver';

export class StorageDriverFactory<T extends StorageDriver> {
    public static create(auth): StorageDriver {
        switch (auth.driver_type) {
            case 's3':
                return new S3StorageDriver(auth);
            case 'sftp':
                return new SftpStorageDriver(auth);
            case 'local':
                return new LocalStorageDriver(auth);
            default:
                throw new TypeError('Unsupported StorageDriver type');
        }
    }
}
