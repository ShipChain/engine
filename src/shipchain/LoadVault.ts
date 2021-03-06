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

import { Vault } from '../vaults/Vault';
import { Wallet } from '../entity/Wallet';

export class LoadVault extends Vault {
    private static readonly TRACKING: string = 'tracking';
    private static readonly SHIPMENT: string = 'shipment';
    private static readonly DOCUMENTS: string = 'documents';
    private static readonly TELEMETRY: string = 'telemetry';

    constructor(storage_driver, id?) {
        super(storage_driver, id);
    }

    protected async initializeMetadata(author: Wallet) {
        await super.initializeMetadata(author);
        this.getOrCreateContainer(author, LoadVault.TRACKING, 'external_list_daily');
        this.getOrCreateContainer(author, LoadVault.SHIPMENT, 'embedded_file');
        this.getOrCreateContainer(author, LoadVault.DOCUMENTS, 'external_file_multi');
        this.getOrCreateContainer(author, LoadVault.TELEMETRY, 'external_list_daily');
        return this.meta;
    }

    async addTrackingData(author: Wallet, payload) {
        await this.loadMetadata();
        await this.containers[LoadVault.TRACKING].append(author, payload);
    }

    async getTrackingData(author: Wallet) {
        await this.loadMetadata();
        return await this.containers[LoadVault.TRACKING].decryptContents(author);
    }

    async addShipmentData(author: Wallet, shipment) {
        await this.loadMetadata();
        await this.containers[LoadVault.SHIPMENT].setContents(author, JSON.stringify(shipment));
    }

    async getShipmentData(author: Wallet) {
        await this.loadMetadata();
        const contents = await this.containers[LoadVault.SHIPMENT].decryptContents(author);
        return JSON.parse(contents);
    }

    async addDocument(author: Wallet, name: string, document: any) {
        await this.loadMetadata();
        await this.containers[LoadVault.DOCUMENTS].setSingleContent(author, name, document);
    }

    async getDocument(author: Wallet, name: string) {
        await this.loadMetadata();
        return await this.containers[LoadVault.DOCUMENTS].decryptContents(author, name);
    }

    async listDocuments() {
        await this.loadMetadata();
        return await this.containers[LoadVault.DOCUMENTS].listFiles();
    }

    async addTelemetryData(author: Wallet, payload) {
        await this.loadMetadata();
        await this.containers[LoadVault.TELEMETRY].append(author, payload);
    }

    async getTelemetryData(author: Wallet) {
        await this.loadMetadata();
        return await this.containers[LoadVault.TELEMETRY].decryptContents(author);
    }

    // Historical Retrievals
    // =====================

    async getHistoricalShipmentByDate(author: Wallet, date: string) {
        await this.loadMetadata();
        const contents = await this.getHistoricalDataByDate(author, LoadVault.SHIPMENT, date);
        contents.shipment = JSON.parse(contents.shipment);
        return contents;
    }

    async getHistoricalTrackingByDate(author: Wallet, date: string) {
        await this.loadMetadata();
        return await this.getHistoricalDataByDate(author, LoadVault.TRACKING, date);
    }

    async getHistoricalDocumentByDate(author: Wallet, date: string, documentName: string) {
        await this.loadMetadata();
        return await this.getHistoricalDataByDate(author, LoadVault.DOCUMENTS, date, documentName);
    }

    async getHistoricalTelemetryByDate(author: Wallet, date: string) {
        await this.loadMetadata();
        return await this.getHistoricalDataByDate(author, LoadVault.TELEMETRY, date);
    }

    async getHistoricalShipmentBySequence(author: Wallet, sequence: number) {
        await this.loadMetadata();
        const contents = await this.getHistoricalDataBySequence(author, LoadVault.SHIPMENT, sequence);
        contents.shipment = JSON.parse(contents.shipment);
        return contents;
    }

    async getHistoricalTrackingBySequence(author: Wallet, sequence: number) {
        await this.loadMetadata();
        return await this.getHistoricalDataBySequence(author, LoadVault.TRACKING, sequence);
    }

    async getHistoricalDocumentBySequence(author: Wallet, sequence: number, documentName: string) {
        await this.loadMetadata();
        return await this.getHistoricalDataBySequence(author, LoadVault.DOCUMENTS, sequence, documentName);
    }

    async getHistoricalTelemetryBySequence(author: Wallet, sequence: number) {
        await this.loadMetadata();
        return await this.getHistoricalDataBySequence(author, LoadVault.TELEMETRY, sequence);
    }
}
