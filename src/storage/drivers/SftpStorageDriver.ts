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

import { DirectoryListing, DriverError, FileEntity, StorageDriver } from '../StorageDriver';
import { MetricsReporter } from '../../MetricsReporter';
import * as path from 'path';

const getStream = require('get-stream');
const SftpClient = require('ssh2-sftp-client');

const metrics = MetricsReporter.Instance;

export class SftpStorageDriver extends StorageDriver {

    constructor(config) {
        super(config, 'sftp');
    }

    private async _connect() {
        try {
            let client = new SftpClient();
            await client.connect(this.config.credentials);
            return client;
        } catch (err) {
            throw new DriverError(DriverError.States.ConnectionError, err);
        }
    }

    private async _validateDirectoryPath(sftp, filePath: string): Promise<any> {
        let parsedPath = this.parseFullVaultPath(filePath);
        return await sftp.mkdir(parsedPath.dir, true);
    }

    async getFile(filePath: string, binary: boolean = false): Promise<any> {
        metrics.countAction('storage_get_file', { driver_type: this.type });
        let encodingSftp = binary ? null : 'utf8';
        let encodingStream = binary ? 'buffer' : 'utf8';

        let sftp = await this._connect();

        let fullVaultPath = this.getFullVaultPath(filePath);

        try {
            let stream = await sftp.get(fullVaultPath, null, encodingSftp);

            let fileContents = await getStream(stream, { encoding: encodingStream }); // set encoding to 'buffer' for binary
            sftp.end();
            return fileContents;
        } catch (err) {
            sftp.end();
            throw new DriverError(DriverError.States.NotFoundError, err);
        }
    }

    async putFile(filePath: string, data: any, binary: boolean = false): Promise<any> {
        metrics.countAction('storage_put_file', { driver_type: this.type });
        let encoding = binary ? null : 'utf8';

        if (!data) {
            throw new DriverError(DriverError.States.ParameterError, null, 'Missing file content');
        }

        let sftp = await this._connect();

        if (encoding) {
            data = Buffer.from(data, encoding);
        }

        await this._validateDirectoryPath(sftp, filePath);

        try {
            await sftp.put(data, this.getFullVaultPath(filePath));
            sftp.end();
            return;
        } catch (err) {
            sftp.end();
            throw new DriverError(DriverError.States.RequestError, err);
        }
    }

    async removeFile(filePath: string): Promise<any> {
        metrics.countAction('storage_remove_file', { driver_type: this.type });
        let sftp = await this._connect();

        let fullVaultPath = this.getFullVaultPath(filePath);

        try {
            await sftp.delete(fullVaultPath);
            sftp.end();
            return;
        } catch (err) {
            sftp.end();
            if (err.message == 'No such file') {
                return;
            }
            throw new DriverError(DriverError.States.RequestError, err);
        }
    }

    async fileExists(filePath: string): Promise<any> {
        metrics.countAction('storage_file_exists', { driver_type: this.type });
        let sftp = await this._connect();

        let parsedPath = this.parseFullVaultPath(filePath);

        try {
            let listing = await sftp.list(parsedPath.dir);
            sftp.end();
            for (let file of listing) {
                if (file.type === '-' && file.name === parsedPath.base) {
                    return true;
                }
            }
            return false;
        } catch (err) {
            sftp.end();
            return false;
        }
    }

    private async _listDirectoryImplementation(sftp, vaultDirectory: string, recursive: boolean): Promise<any> {
        let vaultSearchPath = vaultDirectory || this.base_path;
        let parsedSearchPath = path.parse(vaultSearchPath);
        let directoryRelativeName = vaultDirectory ? parsedSearchPath.base : '';

        try {
            let listing = await sftp.list(vaultSearchPath);

            let directoryListing = new DirectoryListing(directoryRelativeName);

            for (let file of listing) {
                let fileInVaultPath = path.join(vaultSearchPath, file.name);
                let parsedFile = path.parse(fileInVaultPath);

                if (file.type === '-') {
                    directoryListing.addFile(new FileEntity(parsedFile.base));
                }
                if (file.type === 'd') {
                    if (recursive) {
                        directoryListing.addDirectory(
                            await this._listDirectoryImplementation(sftp, fileInVaultPath, recursive),
                        );
                    } else {
                        directoryListing.addDirectory(new DirectoryListing(parsedFile.base));
                    }
                }
            }

            return directoryListing;
        } catch (err) {
            sftp.end();
            if (!vaultDirectory && err.message == 'No such file') {
                return new DirectoryListing('.');
            } else if (vaultDirectory && err.message == 'No such file') {
                throw new DriverError(DriverError.States.NotFoundError, err);
            } else {
                throw new DriverError(DriverError.States.RequestError, err);
            }
        }
    }

    async listDirectory(vaultDirectory: string, recursive: boolean = false): Promise<any> {
        metrics.countAction('storage_list_directory', { driver_type: this.type });
        let sftp = await this._connect();

        let vaultSearchPath = vaultDirectory;
        if (vaultSearchPath) {
            vaultSearchPath = path.join(this.base_path, vaultSearchPath);
        }

        try {
            let fullListing = await this._listDirectoryImplementation(sftp, vaultSearchPath, recursive);
            sftp.end();
            return fullListing;
        } catch (err) {
            sftp.end();
            throw err;
        }
    }
}
