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
import S3 = require('aws-sdk/clients/s3');

const metrics = MetricsReporter.Instance;

export class S3StorageDriver extends StorageDriver {
    s3: S3;
    bucket: string;

    // We can't check this Union Type at runtime for value validity, but it's here as a reminder
    acl: S3.ObjectCannedACL;

    constructor(config) {
        super(config, 's3');

        let s3_options = { apiVersion: '2006-03-01' };

        if (config.hasOwnProperty('client')) {
            s3_options = Object.assign(s3_options, config.client);
        }

        if (!config.hasOwnProperty('Bucket') || typeof config.Bucket == undefined) {
            throw new DriverError(
                this.getContext('Configuration'),
                DriverError.States.ConfigurationError,
                null,
                "Required 'Bucket' configuration missing",
            );
        }

        this.bucket = config.Bucket;
        this.acl = 'public-read';

        if (config.hasOwnProperty('acl')) {
            this.acl = config.acl;
        }

        try {
            this.s3 = new S3(s3_options);
        } catch (err) {
            throw new DriverError(this.getContext('Configuration'), DriverError.States.ConnectionError, err);
        }
    }

    private async __createBucket(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.s3.createBucket(
                {
                    Bucket: this.bucket,
                },
                (err, data) => {
                    if (err) {
                        if (err.code == 'BucketAlreadyOwnedByYou' || err.code == 'BucketAlreadyExists') {
                            resolve(true);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(true);
                    }
                },
            );
        });
    }

    private async _validateBucket(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.s3.headBucket(
                {
                    Bucket: this.bucket,
                },
                (err, data) => {
                    if (err) {
                        reject(new DriverError(this.getContext('List Bucket'), DriverError.States.RequestError, err));
                    } else {
                        resolve(true);
                    }
                },
            );
        });
    }

    async getFile(filePath: string, binary: boolean = false): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_get_file', { driver_type: this.type });
        let fullVaultPath = this.getFullVaultPath(filePath);

        return new Promise((resolve, reject) => {
            this.s3.getObject(
                {
                    Key: fullVaultPath,
                    Bucket: this.bucket,
                },
                (err, data) => {
                    if (err) {
                        metrics.methodTime('storage_get_file', Date.now() - startTime, { driver_type: this.type });

                        reject(new DriverError(this.getContext('Read File'), DriverError.States.NotFoundError, err));
                    } else {
                        let fileContent = data.Body;
                        if (!binary) {
                            fileContent = fileContent.toString();
                        }
                        metrics.methodTime('storage_get_file', Date.now() - startTime, { driver_type: this.type });

                        resolve(fileContent);
                    }
                },
            );
        });
    }

    async putFile(filePath: string, data: any, binary: boolean = false): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_put_file', { driver_type: this.type });
        let fullVaultPath = this.getFullVaultPath(filePath);

        await this._validateBucket();

        return new Promise((resolve, reject) => {
            try {
                this.s3.upload(
                    {
                        Key: fullVaultPath,
                        Body: data,
                        ACL: this.acl,
                        Bucket: this.bucket,
                    },
                    (err, data) => {
                        if (err) {
                            metrics.methodTime('storage_put_file', Date.now() - startTime, { driver_type: this.type });

                            reject(new DriverError(this.getContext('Write File'), DriverError.States.RequestError, err));
                        } else {
                            metrics.methodTime('storage_put_file', Date.now() - startTime, { driver_type: this.type });

                            resolve();
                        }
                    },
                );
            } catch (err) {
                metrics.methodTime('storage_put_file', Date.now() - startTime, { driver_type: this.type });

                reject(new DriverError(this.getContext('Write File'), DriverError.States.ParameterError, err));
            }
        });
    }

    async removeFile(filePath: string): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_remove_file', { driver_type: this.type });
        let fullVaultPath = this.getFullVaultPath(filePath);

        return new Promise((resolve, reject) => {
            this.s3.deleteObject(
                {
                    Key: fullVaultPath,
                    Bucket: this.bucket,
                },
                (err, data) => {
                    if (err) {
                        if (err.code === 'NotFoundError' || err.code === 'NotFound') {
                            metrics.methodTime('storage_remove_file', Date.now() - startTime, {
                                driver_type: this.type,
                            });

                            resolve();
                        } else {
                            metrics.methodTime('storage_remove_file', Date.now() - startTime, {
                                driver_type: this.type,
                            });

                            reject(new DriverError(this.getContext('Delete File'), DriverError.States.UnknownError, err));
                        }
                    } else {
                        metrics.methodTime('storage_remove_file', Date.now() - startTime, { driver_type: this.type });

                        resolve();
                    }
                },
            );
        });
    }

    async removeDirectory(directoryPath: string, recursive: boolean = false): Promise<any> {
        let fullVaultPath = this.getFullVaultPath(directoryPath, true);

        const listParams = {
            Bucket: this.bucket,
            Prefix: fullVaultPath,
        };

        const listedObjects = await this.s3.listObjectsV2(listParams).promise();

        if (listedObjects.Contents.length === 0) return;

        if (!recursive) throw new DriverError(this.getContext('Remove Directory'), DriverError.States.RequestError, null, 'Directory not empty');

        const deleteParams = {
            Bucket: this.bucket,
            Delete: { Objects: [] },
        };

        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        await this.s3.deleteObjects(deleteParams).promise();

        if (listedObjects.IsTruncated) await this.removeDirectory(fullVaultPath, recursive);
    }

    async fileExists(filePath: string): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_file_exists', { driver_type: this.type });
        let fullVaultPath = this.getFullVaultPath(filePath);

        return new Promise((resolve, reject) => {
            this.s3.headObject(
                {
                    Key: fullVaultPath,
                    Bucket: this.bucket,
                },
                (err, data) => {
                    if (err) {
                        if (err.code === 'NotFoundError' || err.code === 'NotFound') {
                            metrics.methodTime('storage_file_exists', Date.now() - startTime, {
                                driver_type: this.type,
                            });

                            resolve(false);
                        } else {
                            metrics.methodTime('storage_file_exists', Date.now() - startTime, {
                                driver_type: this.type,
                            });

                            reject(new DriverError(this.getContext('Head Object'), DriverError.States.UnknownError, err));
                        }
                    } else {
                        if (data.DeleteMarker) {
                            metrics.methodTime('storage_file_exists', Date.now() - startTime, {
                                driver_type: this.type,
                            });

                            resolve(false);
                        }
                        metrics.methodTime('storage_file_exists', Date.now() - startTime, { driver_type: this.type });

                        resolve(true);
                    }
                },
            );
        });
    }

    private async _listDirectoryImplementation(
        vaultDirectory: string,
        recursive: boolean,
        continuationToken?: string,
    ): Promise<any> {
        let vaultSearchPath = vaultDirectory || this.base_path;
        let parsedSearchPath = path.parse(vaultSearchPath);
        let directoryRelativeName = vaultDirectory ? parsedSearchPath.base : '';

        let listParams = {
            Bucket: this.bucket,
            Delimiter: '/',
            Prefix: vaultSearchPath ? vaultSearchPath + '/' : null,
        };

        if (continuationToken) {
            listParams['ContinuationToken'] = continuationToken;
        }

        return new Promise((resolve, reject) => {
            this.s3.listObjectsV2(listParams, async (err, data) => {
                if (err) {
                    if (!vaultDirectory && (err.code == 'NoSuchKey' || err.code == 'NoSuchBucket')) {
                        resolve(new DirectoryListing('.'));
                    } else if (vaultDirectory && err.code == 'NoSuchKey') {
                        reject(new DriverError(this.getContext('List Objects'), DriverError.States.NotFoundError, err));
                    } else {
                        reject(new DriverError(this.getContext('List Objects'), DriverError.States.RequestError, err));
                    }
                } else {
                    let directoryListing = new DirectoryListing(directoryRelativeName);

                    // List the files in this bucket directory
                    for (let file of data.Contents) {
                        let fileInVaultPath = path.join(vaultSearchPath, file.Key);
                        let parsedFile = path.parse(fileInVaultPath);

                        directoryListing.addFile(new FileEntity(parsedFile.base));
                    }

                    // List the sub directories in this location (recurse if requested)
                    for (let commonPrefix of data.CommonPrefixes) {
                        let parsedPrefix = path.parse(commonPrefix.Prefix);
                        let subPrefix = path.join(vaultSearchPath, parsedPrefix.base);

                        if (recursive) {
                            let subDirListing;

                            try {
                                subDirListing = await this._listDirectoryImplementation(subPrefix, recursive);
                            } catch (err) {
                                reject(new DriverError(this.getContext('List Objects'), DriverError.States.UnknownError, err));
                            }

                            directoryListing.addDirectory(subDirListing);
                        } else {
                            directoryListing.addDirectory(new DirectoryListing(parsedPrefix.base));
                        }
                    }

                    // Get the rest of the data if required
                    if (data.IsTruncated) {
                        let additional_content = await this._listDirectoryImplementation(
                            vaultDirectory,
                            recursive,
                            data.NextContinuationToken,
                        );

                        for (let additionalFile of additional_content.files) {
                            let fileInVaultPath = path.join(vaultSearchPath, additionalFile.name);
                            let parsedFile = path.parse(fileInVaultPath);

                            directoryListing.addFile(new FileEntity(parsedFile.base));
                        }
                    }

                    resolve(directoryListing);
                }
            });
        });
    }

    async listDirectory(vaultDirectory: string, recursive: boolean = false): Promise<any> {
        const startTime = Date.now();
        metrics.countAction('storage_list_directory', { driver_type: this.type });
        let vaultSearchPath = vaultDirectory;

        if (vaultSearchPath) {
            if (!(await this.fileExists(vaultSearchPath))) {
                metrics.methodTime('storage_list_directory', Date.now() - startTime, { driver_type: this.type });
                throw new DriverError(this.getContext('List Directory'), DriverError.States.NotFoundError, null);
            }

            vaultSearchPath = path.join(this.base_path, vaultSearchPath);
        }

        const listDirectoryData = await this._listDirectoryImplementation(vaultSearchPath, recursive);
        metrics.methodTime('storage_list_directory', Date.now() - startTime, { driver_type: this.type });

        return listDirectoryData;
    }
}
