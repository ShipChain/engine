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

const fs = require('fs');
const util = require('util');
const path = require('path');
const _mkdirp = require('mkdirp');

// Convert mkdirp into Promise version of same
const mkdirp = util.promisify(_mkdirp);

export class LocalStorageDriver extends StorageDriver {
    constructor(config) {
        super(config);
    }

    private async _validateDirectoryPath(filePath: string): Promise<any> {
        let parsedPath = this.parseFullVaultPath(filePath);
        return await mkdirp(parsedPath.dir);
    }

    checkIfFile(file) {
        return new Promise((resolve, reject) => {
            fs.stat(file, (err, stats) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        resolve(false);
                    } else {
                        reject(new DriverError(DriverError.States.RequestError, err));
                    }
                } else {
                    resolve(stats.isFile());
                }
            });
        });
    }

    async getFile(filePath: string, binary: boolean = false): Promise<any> {
        let encoding = binary ? null : 'utf8';
        return new Promise((resolve, reject) => {
            fs.readFile(this.getFullVaultPath(filePath), encoding, (err, data) => {
                if (err) {
                    reject(new DriverError(DriverError.States.NotFoundError, err));
                } else {
                    resolve(data);
                }
            });
        });
    }

    async putFile(filePath: string, data: any, binary: boolean = false): Promise<any> {
        let encoding = binary ? null : 'utf8';

        if (!data) {
            throw new DriverError(DriverError.States.ParameterError, null, 'Missing file content');
        }

        await this._validateDirectoryPath(filePath);

        return new Promise((resolve, reject) => {
            fs.writeFile(this.getFullVaultPath(filePath), data, encoding, (err, data) => {
                if (err) {
                    reject(new DriverError(DriverError.States.RequestError, err));
                } else {
                    resolve();
                }
            });
        });
    }

    async removeFile(filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            fs.unlink(this.getFullVaultPath(filePath), (err, data) => {
                if (err) {
                    if (err.code == 'ENOENT') {
                        resolve();
                    } else {
                        reject(new DriverError(DriverError.States.RequestError, err));
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    async fileExists(filePath: string): Promise<any> {
        return await this.checkIfFile(this.getFullVaultPath(filePath));
    }

    private async _listDirectoryImplementation(vaultDirectory: string, recursive: boolean): Promise<any> {
        let vaultSearchPath = vaultDirectory || this.base_path;
        let parsedSearchPath = path.parse(vaultSearchPath);
        let directoryRelativeName = vaultDirectory ? parsedSearchPath.base : '';

        return new Promise((resolve, reject) => {
            fs.readdir(vaultSearchPath, async (err, files) => {
                if (err) {
                    if (!vaultDirectory && err.code == 'ENOENT') {
                        resolve(new DirectoryListing('.'));
                    } else if (vaultDirectory && err.code == 'ENOENT') {
                        reject(new DriverError(DriverError.States.NotFoundError, err));
                    } else {
                        reject(new DriverError(DriverError.States.RequestError, err));
                    }
                } else {
                    let directoryListing = new DirectoryListing(directoryRelativeName);

                    for (let file of files) {
                        let fileInVaultPath = path.join(vaultSearchPath, file);
                        let parsedFile = path.parse(fileInVaultPath);

                        let itemIsFile;
                        try {
                            itemIsFile = await this.checkIfFile(fileInVaultPath);
                        } catch (err) {
                            reject(new DriverError(DriverError.States.UnknownError, err));
                        }

                        if (itemIsFile) {
                            directoryListing.addFile(new FileEntity(parsedFile.base));
                        } else {
                            if (recursive) {
                                let subDirListing;
                                try {
                                    subDirListing = await this._listDirectoryImplementation(fileInVaultPath, recursive);
                                } catch (err) {
                                    reject(new DriverError(DriverError.States.UnknownError, err));
                                }
                                directoryListing.addDirectory(subDirListing);
                            } else {
                                directoryListing.addDirectory(new DirectoryListing(parsedFile.base));
                            }
                        }
                    }

                    resolve(directoryListing);
                }
            });
        });
    }

    async listDirectory(vaultDirectory: string, recursive: boolean = false): Promise<any> {
        let vaultSearchPath = vaultDirectory;

        if (vaultSearchPath) {
            vaultSearchPath = path.join(this.base_path, vaultSearchPath);
        }
        return await this._listDirectoryImplementation(vaultSearchPath, recursive);
    }
}
