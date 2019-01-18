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
import { StorageDriverFactory } from '../storage/StorageDriverFactory';
import { DirectoryListing, DriverError, FileEntity } from '../storage/StorageDriver';
import * as path from 'path';
import * as fs from 'fs';

// https://staxmanade.com/2015/11/testing-asyncronous-code-with-mochajs-and-es7-async-await/
// Automatically wrap a test case with try/catch and call the async done() when it's complete
const mochaAsync = fn => {
    return async done => {
        try {
            await fn();
            done();
        } catch (err) {
            done(err);
        }
    };
};

const S3_DRIVER_TESTS = process.env.S3_DRIVER_TESTS || false;
const SFTP_DRIVER_TESTS = process.env.SFTP_DRIVER_TESTS || false;

// SFTP Configuration.  When run with `bin/docker_tests` this pulls environment variables from circleci.yml, or
// uses defaults for the SFTP service started via `bin/dc up sftp`
const SFTP_HOST = process.env.SFTP_HOST || 'localhost';
const SFTP_PORT = process.env.SFTP_PORT || '2222';
const SFTP_USER = process.env.SFTP_USER || 'shipchain_user';
const SFTP_PASS = process.env.SFTP_PASS || 'shipchain_password';

// S3 Configuration.  When run with `bin/docker_tests` this pulls environment variables from circleci.yml, or
// uses defaults for the Minio service started via `bin/dc up sftp`
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9099';
const S3_BUCKET = process.env.S3_BUCKET || 'my-test-bucket';
const S3_ACCESSKEY = process.env.S3_ACCESSKEY || 'myMinioAccessKey';
const S3_SECRETKEY = process.env.S3_SECRETKEY || 'myMinioSecretKey';

const epochDirectory = new Date().getTime().toString();
const utf8HelloWorld = 'Hello, World! Привет мир! 你好，世界！';

const storageConfigs = {
    local: {
        root: {
            driver_type: 'local',
            base_path: epochDirectory,
            variant: 'root',
        },
        sub: {
            driver_type: 'local',
            base_path: path.join(epochDirectory, 'subdirectory'),
            variant: 'sub',
        },
    },
    sftp: {
        root: {
            driver_type: 'sftp',
            credentials: {
                host: SFTP_HOST,
                port: SFTP_PORT,
                username: SFTP_USER,
                password: SFTP_PASS,
            },
            base_path: 'upload',
            variant: 'root',
        },
        sub: {
            driver_type: 'sftp',
            credentials: {
                host: SFTP_HOST,
                port: SFTP_PORT,
                username: SFTP_USER,
                password: SFTP_PASS,
            },
            base_path: path.join('upload', epochDirectory),
            variant: 'sub',
        },
    },
    s3: {
        root: {
            driver_type: 's3',
            Bucket: S3_BUCKET,
            client: {
                endpoint: S3_ENDPOINT,
                accessKeyId: S3_ACCESSKEY,
                secretAccessKey: S3_SECRETKEY,
                s3ForcePathStyle: true,
                signatureVersion: "v4"
            },
            base_path: '',
            acl: 'public-read',
            variant: 'root',
        },
        sub: {
            driver_type: 's3',
            Bucket: S3_BUCKET,
            client: {
                endpoint: S3_ENDPOINT,
                accessKeyId: S3_ACCESSKEY,
                secretAccessKey: S3_SECRETKEY,
                s3ForcePathStyle: true,
                signatureVersion: "v4"
            },
            base_path: epochDirectory + '/multi/level',
            acl: 'public-read',
            variant: 'sub',
        },
    },
};

const fileConfigs = {
    text: {
        shallow: {
            type: 'text',
            file: 'test_text.txt',
            data: utf8HelloWorld,
            binary: false,
            variant: 'shallow',
        },
        deep: {
            type: 'text',
            file: path.join(epochDirectory, 'deep', 'folder', 'test_deep.txt'),
            data: utf8HelloWorld,
            binary: false,
            variant: 'deep',
        },
    },
    binary: {
        shallow: {
            type: 'binary',
            file: 'test_binary.txt',
            data: Buffer.from(utf8HelloWorld, 'utf8'),
            binary: true,
            variant: 'shallow',
        },
    },
};

const emptyDirectoryListing = new DirectoryListing('.');

describe('StorageDriver ', function() {
    // Create and Cleanup the local testing directory
    // ==============================================
    beforeAll(() => {
        fs.mkdirSync(epochDirectory);
    });
    afterAll(() => {
        fs.rmdirSync(epochDirectory);
    });

    // Run all the following tests on multiple StorageDriver configurations
    // ====================================================================
    const testStorageConfigs = [storageConfigs.local.root, storageConfigs.local.sub];

    if (S3_DRIVER_TESTS) {
        testStorageConfigs.push(storageConfigs.s3.root);
        testStorageConfigs.push(storageConfigs.s3.sub);
    }

    if (SFTP_DRIVER_TESTS) {
        testStorageConfigs.push(storageConfigs.sftp.sub);
        testStorageConfigs.push(storageConfigs.sftp.root);
    }

    testStorageConfigs.forEach(function(storageConfig) {
        describe(storageConfig.driver_type + ' [' + storageConfig.variant + ' folder]', function() {
            let storageDriver;

            beforeAll(async () => {
                storageDriver = StorageDriverFactory.create(storageConfig);

                if(storageConfig.driver_type == 's3'){
                    await storageDriver.__createBucket();
                }
            });

            // Test the directory listing prior to any File Operation tests
            // ============================================================
            it(
                `can list the empty vault directory`,
                mochaAsync(async () => {
                    let result = await storageDriver.listDirectory();
                    expect(result).toEqual(emptyDirectoryListing);

                    result = await storageDriver.listDirectory(null, true);
                    expect(result).toEqual(emptyDirectoryListing);
                }),
            );

            it(
                `throws when listing a non-existing vault directory`,
                mochaAsync(async () => {
                    let caughtError;

                    try {
                        caughtError = await storageDriver.listDirectory('not_a_directory"');
                    } catch (err) {
                        caughtError = err;
                    }

                    expect(caughtError.message).toMatch(DriverError.States.NotFoundError);
                }),
            );

            // File Operation tests
            // ====================
            [fileConfigs.text.shallow, fileConfigs.text.deep, fileConfigs.binary.shallow].forEach(function(fileConfig) {
                // As the storage backends persist data between individual tests below, the order of these tests is
                // important.  I.E. One test removes a file and one ensures an exception is thrown when accessing
                // the same (deleted) file.

                // Normal file operation tests
                // ---------------------------
                it(
                    `can store a ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.putFile(fileConfig.file, fileConfig.data, fileConfig.binary);
                        expect(result).toBeUndefined();
                    }),
                );

                it(
                    `can check existence of the stored ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.fileExists(fileConfig.file);
                        expect(result).toBeTruthy();
                    }),
                );

                it(
                    `includes the stored ${fileConfig.variant} ${fileConfig.type} file in the listing`,
                    mochaAsync(async () => {
                        let directoryListing = await storageDriver.listDirectory(null, true);

                        if (fileConfig.variant == 'shallow') {
                            expect(directoryListing.files[0].name).toEqual(fileConfig.file);
                        } else {
                            let directories = fileConfig.file.split('/');

                            let directoryCount = 1;
                            let totalDirectories = directories.length;

                            for (let directory of directories) {
                                if (directoryCount == totalDirectories) {
                                    expect(directoryListing.files[0].name).toEqual(path.parse(fileConfig.file).base);
                                } else {
                                    directoryCount++;
                                    expect(directoryListing.directories[0].name).toEqual(directory);
                                    directoryListing = directoryListing.directories[0];
                                }
                            }
                        }
                    }),
                );

                it(
                    `can retrieve the ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.getFile(fileConfig.file, fileConfig.binary);
                        expect(result).toEqual(fileConfig.data);
                    }),
                );

                it(
                    `can delete the ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.removeFile(fileConfig.file);
                        expect(result).toBeUndefined();
                    }),
                );

                it(
                    `can check non-existence of the deleted ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.fileExists(fileConfig.file);
                        expect(result).toBeFalsy();
                    }),
                );

                // Exception Tests
                // ---------------
                it(
                    `throws when retrieving a non-existent ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let caughtError;

                        try {
                            await storageDriver.getFile(fileConfig.file, fileConfig.binary);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.NotFoundError);
                    }),
                );

                it(
                    `throws when retrieving a ${fileConfig.variant} ${fileConfig.type} file without providing a name`,
                    mochaAsync(async () => {
                        let caughtError;

                        try {
                            await storageDriver.getFile(null, fileConfig.binary);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.ParameterError);
                    }),
                );

                it(
                    `throws when putting a null ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let caughtError;

                        try {
                            await storageDriver.putFile(fileConfig.file, null, fileConfig.binary);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.ParameterError);
                    }),
                );

                it(
                    `throws when putting an unnamed ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let caughtError;

                        try {
                            await storageDriver.putFile(null, fileConfig.data, fileConfig.binary);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.ParameterError);
                    }),
                );

                it(
                    `throws when deleting a ${fileConfig.variant} ${fileConfig.type} file without providing a name`,
                    mochaAsync(async () => {
                        let caughtError;

                        try {
                            await storageDriver.removeFile(null);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.ParameterError);
                    }),
                );

                it(
                    `does not throw when deleting a non-existing ${fileConfig.variant} ${fileConfig.type} file`,
                    mochaAsync(async () => {
                        let result = await storageDriver.removeFile(fileConfig.file);
                        expect(result).toBeUndefined();
                    }),
                );

                it(
                    `throws when deleting a non-empty ${fileConfig.variant} ${fileConfig.type} directory`,
                    mochaAsync(async () => {
                        let caughtError;

                        let result = await storageDriver.putFile(fileConfig.file, fileConfig.data, fileConfig.binary);
                        expect(result).toBeUndefined();

                        try {
                            await storageDriver.removeDirectory(null, false);
                        } catch (err) {
                            caughtError = err;
                        }

                        expect(caughtError.message).toMatch(DriverError.States.RequestError);
                    }),
                );

                it(
                    `does not throws when recursively deleting a non-empty ${fileConfig.variant} ${fileConfig.type} directory`,
                    mochaAsync(async () => {

                        // Recursively deleting an SFTP _root_ directory will cause permission errors and should be avoided
                        if(storageConfig.driver_type === "sftp" && storageConfig.variant === "root"){
                            expect(true).toBeTruthy();
                        }
                        else {
                            let result = await storageDriver.putFile(fileConfig.file, fileConfig.data, fileConfig.binary);
                            expect(result).toBeUndefined();

                            result = await storageDriver.removeDirectory(null, true);
                            expect(result).toBeUndefined();
                        }
                    }),
                );
            });
        });
    });
});
