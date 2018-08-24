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

import * as path from 'path';

export abstract class StorageDriver {
    protected config;
    protected base_path = './'; // Default to root directory, overwrite with vault config if desired

    protected constructor(config) {
        this.config = config;
        if (typeof config.base_path != undefined) {
            this.base_path = config.base_path;
        }
    }

    protected getFullVaultPath(relativeFilePath: string) {
        if (!relativeFilePath) {
            throw new DriverError(DriverError.States.ParameterError, null, 'Missing filename from request');
        }

        if (this.base_path) {
            return path.join(this.base_path, relativeFilePath);
        } else {
            return relativeFilePath;
        }
    }

    protected parseFullVaultPath(relativeFilePath: string) {
        let fullFilePath = this.getFullVaultPath(relativeFilePath);
        return path.parse(fullFilePath);
    }

    abstract async getFile(filePath: string, binary?: boolean): Promise<any>;

    abstract async putFile(filePath: string, data: any, binary?: boolean): Promise<any>;

    abstract async removeFile(filePath: string): Promise<any>;

    abstract async fileExists(filePath: string): Promise<any>;

    abstract async listDirectory(vaultDirectory: string, recursive?: boolean): Promise<any>;
}

enum DriverErrorStates {
    ConfigurationError = 'Error in Storage Driver Configuration',
    ConnectionError = 'Error in Connection to Storage Driver',
    NotFoundError = 'File Not Found',
    ParameterError = 'Error in Parameters',
    RequestError = 'Error in Request',
    UnknownError = 'Unknown Error from Storage Driver',
}

export class DriverError extends Error {
    static States = DriverErrorStates;

    errorState: DriverErrorStates;
    wrappedError: Error;
    reason: string;

    constructor(errorState: DriverErrorStates, wrappedError: Error, reason?: string) {
        super(errorState);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, DriverError.prototype);

        this.errorState = errorState;
        this.wrappedError = wrappedError;

        if (typeof reason == undefined) {
            this.reason = wrappedError.message;
        } else {
            this.reason = reason;
        }
    }
}

export class DirectoryListing extends Object {
    name: string;
    files: FileEntity[];
    directories: DirectoryListing[];

    constructor(name: string) {
        super();
        this.name = path.normalize(name);
        this.files = [];
        this.directories = [];
    }

    addFile(file: FileEntity) {
        this.files.push(file);
    }

    addDirectory(directory: DirectoryListing) {
        this.directories.push(directory);
    }
}

export class FileEntity extends Object {
    name: string;

    constructor(name: string) {
        super();
        this.name = path.normalize(name);
    }
}
