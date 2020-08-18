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




require('../../__tests__/testLoggingConfig');

import 'mocha';
import { ShipChainVault } from '../vaults/ShipChainVault';
import { Telemetry } from "../vaults/primitives/Telemetry";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const TelemetryPrimitiveTests = function() {
    let author: Wallet;
    let vault: ShipChainVault;

    beforeAll(async () => {
        await EncryptorContainer.init();
        author = await Wallet.generate_entity();
    });

    beforeEach(async() => {
        vault = new ShipChainVault(storage_driver);
        await vault.getOrCreateMetadata(author);
    });

    afterEach(async() => {
        await vault.deleteEverything();
    });

    afterAll(async () => {
        CloseConnection();
    });

    let refreshPrimitive = async(): Promise<Telemetry> => {
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Telemetry');
    };

    let injectPrimitive = async (): Promise<Telemetry> => {
        vault.injectPrimitive('Telemetry');
        return await refreshPrimitive();
    };

    it(`can be created`, async () => {
        let telemetry = new Telemetry(vault);

        expect(telemetry.name).toEqual('Telemetry');
        expect(telemetry.container_type).toEqual('external_list_daily');
        expect(telemetry.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let telemetry = new Telemetry(vault);

        let telemetryData = await telemetry.getTelemetry(author);

        expect(telemetryData).toEqual([]);
    });

    it(`can set one value`, async () => {
        let telemetry = await injectPrimitive();

        await telemetry.addTelemetry(author, {
            "one": 1,
        });

        telemetry = await refreshPrimitive();

        let telemetryData = await telemetry.getTelemetry(author);
        expect(telemetryData.length).toEqual(1);
        expect(telemetryData[0]).toEqual({
            "one": 1,
        });
    });

    it(`can append multiple values`, async () => {
        let telemetry = await injectPrimitive();

        await telemetry.addTelemetry(author, {
            "one": 1,
        });
        await telemetry.addTelemetry(author, {
            "two": 2,
        });

        telemetry = await refreshPrimitive();

        let telemetryData = await telemetry.getTelemetry(author);
        expect(telemetryData.length).toEqual(2);
        expect(telemetryData[0]).toEqual({
            "one": 1,
        });
        expect(telemetryData[1]).toEqual({
            "two": 2,
        });
    });

};
