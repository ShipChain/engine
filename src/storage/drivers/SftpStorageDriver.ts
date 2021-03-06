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
            throw new DriverError(this.getContext('Connect'), DriverError.States.ConnectionError, err);
        }
    }

    /**
     * Replicate mkdir functionality, safely, by checking existence of directories
     * and creating them in sequence to prevent errors when recursive mkdir hangs
     *
     * @param sftp SFTP Client object
     * @param dirPath <string> Full directory path
     * @private
     */
    private static async _safeRecursiveMkdir(sftp, dirPath: string): Promise<any> {
        let walkDirs = dirPath.split(path.sep);

        for (let index = 0; index <= walkDirs.length; index++) {
            let sequentialDirs = walkDirs.slice(0, index + 1);
            let newDirPath = sequentialDirs.join(path.sep);

            try {
                await sftp.list(newDirPath);
            } catch (err) {
                if (err.message.includes('No such file')) {
                    await sftp.mkdir(newDirPath);
                } else {
                    throw new DriverError(`SFTP Make Directory`, DriverError.States.NotFoundError, err);
                }
            }
        }
    }

    private async _validateDirectoryPath(sftp, filePath: string): Promise<any> {
        let parsedPath = this.parseFullVaultPath(filePath);
        try {
            await sftp.list(parsedPath.dir);
        } catch (err) {
            if (err.message.includes('No such file')) {
                await SftpStorageDriver._safeRecursiveMkdir(sftp, parsedPath.dir);
            } else {
                throw new DriverError(this.getContext('List Directory'), DriverError.States.NotFoundError, err);
            }
        }
    }

    async getFile(filePath: string, binary: boolean = false): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_get_file', { driver_type: this.type });
        let encodingSftp = binary ? null : 'utf8';

        let sftp = await this._connect();

        let fullVaultPath = this.getFullVaultPath(filePath);

        try {
            let data = await sftp.get(fullVaultPath, undefined, { encoding: encodingSftp });
            sftp.end();
            metrics.methodTime('storage_get_file', Date.now() - startTime, { driver_type: this.type });
            return data;
        } catch (err) {
            sftp.end();
            metrics.methodTime('storage_get_file', Date.now() - startTime, { driver_type: this.type });
            throw new DriverError(this.getContext('Read File'), DriverError.States.NotFoundError, err);
        }
    }

    async putFile(filePath: string, data: any, binary: boolean = false): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_put_file', { driver_type: this.type });
        let encoding: BufferEncoding = binary ? null : 'utf8';

        if (!data) {
            throw new DriverError(
                this.getContext('Write File'),
                DriverError.States.ParameterError,
                null,
                'Missing file content',
            );
        }

        let sftp = await this._connect();

        if (encoding) {
            data = Buffer.from(data, encoding);
        }

        await this._validateDirectoryPath(sftp, filePath);

        try {
            await sftp.put(data, this.getFullVaultPath(filePath));
            sftp.end();
            metrics.methodTime('storage_put_file', Date.now() - startTime, { driver_type: this.type });
            return;
        } catch (err) {
            sftp.end();
            metrics.methodTime('storage_put_file', Date.now() - startTime, { driver_type: this.type });
            throw new DriverError(this.getContext('Write File'), DriverError.States.RequestError, err);
        }
    }

    async removeFile(filePath: string): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_remove_file', { driver_type: this.type });
        let sftp = await this._connect();

        let fullVaultPath = this.getFullVaultPath(filePath);

        try {
            await sftp.delete(fullVaultPath);
            sftp.end();
            metrics.methodTime('storage_remove_file', Date.now() - startTime, { driver_type: this.type });
            return;
        } catch (err) {
            sftp.end();
            if (err.message.includes('No such file')) {
                metrics.methodTime('storage_remove_file', Date.now() - startTime, { driver_type: this.type });
                return;
            }
            metrics.methodTime('storage_remove_file', Date.now() - startTime, { driver_type: this.type });
            throw new DriverError(this.getContext('Delete File'), DriverError.States.RequestError, err);
        }
    }

    async removeDirectory(directoryPath: string, recursive: boolean = false): Promise<any> {
        let fullVaultPath = this.getFullVaultPath(directoryPath, true);

        const startTime = Date.now();
        metrics.countAction('storage_remove_directory', { driver_type: this.type });
        let sftp = await this._connect();

        try {
            await sftp.rmdir(fullVaultPath, recursive);
            sftp.end();
            metrics.methodTime('storage_remove_directory', Date.now() - startTime, { driver_type: this.type });
            return;
        } catch (err) {
            sftp.end();
            if (err.message.includes('No such file')) {
                metrics.methodTime('storage_remove_directory', Date.now() - startTime, { driver_type: this.type });
                return;
            }
            metrics.methodTime('storage_remove_directory', Date.now() - startTime, { driver_type: this.type });
            throw new DriverError(this.getContext('Remove Directory'), DriverError.States.RequestError, err);
        }
    }

    async fileExists(filePath: string): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_file_exists', { driver_type: this.type });
        let sftp = await this._connect();

        let parsedPath = this.parseFullVaultPath(filePath);

        try {
            let listing = await sftp.list(parsedPath.dir);
            sftp.end();
            for (let file of listing) {
                if (file.type === '-' && file.name === parsedPath.base) {
                    metrics.methodTime('storage_file_exists', Date.now() - startTime, { driver_type: this.type });
                    return true;
                }
            }
            metrics.methodTime('storage_file_exists', Date.now() - startTime, { driver_type: this.type });
            return false;
        } catch (err) {
            sftp.end();
            metrics.methodTime('storage_file_exists', Date.now() - startTime, { driver_type: this.type });
            return false;
        }
    }

    private async _listDirectoryImplementation(
        sftp,
        vaultDirectory: string,
        recursive: boolean,
        errorOnEmpty: boolean,
    ): Promise<any> {
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
                            await this._listDirectoryImplementation(sftp, fileInVaultPath, recursive, errorOnEmpty),
                        );
                    } else {
                        directoryListing.addDirectory(new DirectoryListing(parsedFile.base));
                    }
                }
            }

            return directoryListing;
        } catch (err) {
            sftp.end();
            if (!errorOnEmpty && err.message.includes('No such file')) {
                return new DirectoryListing('.');
            } else if (errorOnEmpty && err.message.includes('No such file')) {
                throw new DriverError(this.getContext('List Directory'), DriverError.States.NotFoundError, err);
            } else {
                throw new DriverError(this.getContext('List Directory'), DriverError.States.RequestError, err);
            }
        }
    }

    async listDirectory(
        vaultDirectory: string,
        recursive: boolean = false,
        errorOnEmpty: boolean = true,
    ): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_list_directory', { driver_type: this.type });
        let sftp = await this._connect();

        let vaultSearchPath = vaultDirectory;
        if (vaultSearchPath) {
            vaultSearchPath = path.join(this.base_path, vaultSearchPath);
        }

        try {
            let fullListing = await this._listDirectoryImplementation(sftp, vaultSearchPath, recursive, errorOnEmpty);
            sftp.end();
            metrics.methodTime('storage_list_directory', Date.now() - startTime, { driver_type: this.type });
            return fullListing;
        } catch (err) {
            sftp.end();
            metrics.methodTime('storage_list_directory', Date.now() - startTime, { driver_type: this.type });
            throw err;
        }
    }
}
