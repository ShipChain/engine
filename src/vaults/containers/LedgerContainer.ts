/*
 * Copyright 2019 ShipChain, Inc.
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

import { Vault } from '../Vault';
import { Wallet } from '../../entity/Wallet';
import * as path from 'path';

// Import Moment Typings and Functions
import { Moment } from 'moment';
import moment from 'moment';
import { ExternalFileMultiContainer } from './ExternalDirectoryContainer';

class LedgerEntry {
    public type: string;
    public action: string;
    public name: string;

    constructor(type: string, action: string, name: string) {
        this.type = type;
        this.action = action;
        this.name = name;
    }

    public static fromIndexData(indexData: any): LedgerEntry {
        const action = indexData.action.split('.');
        const containerType = action[1];
        const containerAction = action[2];
        return new LedgerEntry(containerType, containerAction, indexData.name);
    }

    public isFileContainer(): Boolean {
        return this.type.indexOf('_file') != -1;
    }

    public isListContainer(): Boolean {
        return this.type.indexOf('_list') != -1;
    }

    public isMultiFileContainer(): Boolean {
        return this.isFileContainer() && this.type.indexOf('_multi') != -1;
    }

    public isSingleFileContainer(): Boolean {
        return this.isFileContainer() && this.type.indexOf('_multi') == -1;
    }

    public isMultiFileSetContentAction(): Boolean {
        return this.isMultiFileContainer() && this.action.indexOf('setsinglecontent') != -1;
    }

    public isSingleFileSetContentAction(): Boolean {
        return this.isSingleFileContainer() && this.action.indexOf('setcontents') != -1;
    }

    public isListAppendAction(): Boolean {
        return this.isListContainer() && this.action.indexOf('append') != -1;
    }
}

export class ExternalFileLedgerContainer extends ExternalFileMultiContainer {
    public container_type: string = 'external_file_ledger';
    private nextIndex: number;
    private static readonly INDEX_PADDING: number = 16;
    public static readonly MOMENT_FORMAT: string = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

    constructor(vault: Vault, name: string, meta?: any) {
        super(vault, name, meta);
        this.nextIndex = meta && meta.nextIndex ? meta.nextIndex : 1;
    }

    private paddedIndex(index: number = this.nextIndex): string {
        // 9007199254740991 Max Safe Integer
        if (index === Number.MAX_SAFE_INTEGER) {
            throw new Error(`Vault max size reached [index: ${index}]`);
        }

        let paddedIndex: string = index + '';
        while (paddedIndex.length < ExternalFileLedgerContainer.INDEX_PADDING) {
            paddedIndex = '0' + paddedIndex;
        }
        return paddedIndex;
    }

    async addIndexedEntry(author: Wallet, blob: any) {
        await super.setSingleContent(author, this.paddedIndex(), JSON.stringify(blob));
        this.nextIndex = this.nextIndex + 1;
    }

    private static getFileContent(
        ledgerEntry: LedgerEntry,
        indexData: any,
        decryptedContainers: any,
        subFile?: string,
    ) {
        let foundApplicableData = false;

        // Multi-file containers
        if (ledgerEntry.isMultiFileSetContentAction()) {
            if (!decryptedContainers[ledgerEntry.name]) {
                decryptedContainers[ledgerEntry.name] = {};
            }

            if (subFile) {
                if (subFile === indexData.params.fileName) {
                    decryptedContainers[ledgerEntry.name][subFile] = indexData.params.blob;
                    foundApplicableData = true;
                }
            } else {
                decryptedContainers[ledgerEntry.name][indexData.params.fileName] = indexData.params.blob;
                foundApplicableData = true;
            }
        }

        // Single-file containers
        else if (ledgerEntry.isSingleFileSetContentAction()) {
            decryptedContainers[ledgerEntry.name] = indexData.params;
            foundApplicableData = true;
        }

        return [foundApplicableData, decryptedContainers];
    }

    async decryptToIndex(
        user: Wallet,
        container: string = null,
        index: number = this.nextIndex - 1,
        subFile?: string,
        approximateIndex: boolean = true,
    ) {
        let foundApplicableData: boolean = false;
        let decryptedContainers = {};
        let ledgerEntry: LedgerEntry = null;

        // If container type is a file, then go straight to index
        if (!approximateIndex && container && this.vault.containers[container].container_type.indexOf('_file') != -1) {
            let indexData = await this.decryptContents(user, this.paddedIndex(+index));
            indexData = JSON.parse(indexData);

            ledgerEntry = LedgerEntry.fromIndexData(indexData);

            if (container != ledgerEntry.name) {
                throw new Error(`Ledger data at index ${index} is not for container ${container}`);
            }

            [foundApplicableData, decryptedContainers] = ExternalFileLedgerContainer.getFileContent(
                ledgerEntry,
                indexData,
                decryptedContainers,
                subFile,
            );
        }

        // Otherwise we'll have to rebuild one by one
        else {
            for (let desiredIndex = 1; desiredIndex <= index && desiredIndex < this.nextIndex; desiredIndex++) {
                let foundApplicableDataAtIndex = false;
                let indexData = await this.decryptContents(user, this.paddedIndex(+desiredIndex));
                indexData = JSON.parse(indexData);

                ledgerEntry = LedgerEntry.fromIndexData(indexData);

                if (!container || ledgerEntry.name === container) {
                    // Rebuild File containers
                    if (ledgerEntry.isFileContainer()) {
                        [foundApplicableDataAtIndex, decryptedContainers] = ExternalFileLedgerContainer.getFileContent(
                            ledgerEntry,
                            indexData,
                            decryptedContainers,
                            subFile,
                        );
                    }

                    // Rebuild List containers
                    else if (ledgerEntry.isListContainer()) {
                        if (!decryptedContainers[container]) {
                            decryptedContainers[container] = [];
                        }
                        if (ledgerEntry.isListAppendAction()) {
                            decryptedContainers[container].push(indexData.params);
                            foundApplicableDataAtIndex = true;
                        }
                    }
                }

                foundApplicableData = foundApplicableData || foundApplicableDataAtIndex;
            }
        }

        if (!foundApplicableData) {
            throw new Error(`No data found at specific sequence`);
        }

        return decryptedContainers;
    }

    async decryptToDate(user: Wallet, container: string = null, date: string, subFile?: string) {
        const toDate: Moment = moment(date, [ExternalFileLedgerContainer.MOMENT_FORMAT, moment.ISO_8601], true).add(
            1,
            'ms',
        );

        if (!toDate.isValid()) {
            throw new Error(`Invalid Date '${date}' not in format '${ExternalFileLedgerContainer.MOMENT_FORMAT}'`);
        }

        let toIndex = -1;
        let onDate: string;

        // Find the latest Ledger index before our toDate
        for (let property in this.meta) {
            if (this.meta.hasOwnProperty(property) && property.indexOf(this.name) !== -1) {
                const indexDate: Moment = moment(
                    this.meta[property].at,
                    [ExternalFileLedgerContainer.MOMENT_FORMAT, moment.ISO_8601],
                    true,
                );
                if (!indexDate.isValid()) {
                    throw new Error(`Vault Ledger data is invalid! [${container}.${property}]`);
                }

                if (indexDate.isBefore(toDate)) {
                    // Remove the container name from the property
                    let thisIndex = property.split(path.sep)[1];

                    // Remove the file extension from the property
                    thisIndex = thisIndex.slice(0, thisIndex.lastIndexOf('.'));

                    toIndex = +thisIndex;
                    onDate = this.meta[property].at;
                } else {
                    break;
                }
            }
        }

        if (toIndex == -1) {
            throw new Error(`No data found for date`);
        }

        try {
            return {
                on_date: onDate,
                ...(await this.decryptToIndex(user, container, toIndex, subFile)),
            };
        } catch (err) {
            throw new Error(`No data found for date`);
        }
    }

    async buildMetadata(author: Wallet) {
        const metadata = await super.buildMetadata(author);
        metadata.nextIndex = this.nextIndex;
        return metadata;
    }
}
