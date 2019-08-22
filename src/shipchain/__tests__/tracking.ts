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
import { Tracking } from "../vaults/primitives/Tracking";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const TrackingPrimitiveTests = async function() {
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

    let injectPrimitive = async (): Promise<Tracking> => {
        vault.injectPrimitive('Tracking');
        await vault.writeMetadata(author);
        await vault.loadMetadata();
        return vault.getPrimitive('Tracking');
    };

    it(`can be created`, async () => {
        let tracking = new Tracking(vault);

        expect(tracking.name).toEqual('Tracking');
        expect(tracking.container_type).toEqual('external_list_daily');
        expect(tracking.meta.isPrimitive).toBeTruthy();
    });

    it(`is empty on creation`, async () => {
        let tracking = new Tracking(vault);

        let trackingData = await tracking.getTracking(author);

        expect(trackingData).toEqual([]);
    });

    it(`can set one value`, async () => {
        let tracking = await injectPrimitive();

        await tracking.addTracking(author, {
            "one": 1,
        });

        await vault.writeMetadata(author);
        await vault.loadMetadata();
        tracking = vault.getPrimitive('Tracking');

        let trackingData = await tracking.getTracking(author);
        expect(trackingData.length).toEqual(1);
        expect(trackingData[0]).toEqual({
            "one": 1,
        });
    });

    it(`can append multiple values`, async () => {
        let tracking = await injectPrimitive();

        await tracking.addTracking(author, {
            "one": 1,
        });
        await tracking.addTracking(author, {
            "two": 2,
        });

        await vault.writeMetadata(author);
        await vault.loadMetadata();
        tracking = vault.getPrimitive('Tracking');

        let trackingData = await tracking.getTracking(author);
        expect(trackingData.length).toEqual(2);
        expect(trackingData[0]).toEqual({
            "one": 1,
        });
        expect(trackingData[1]).toEqual({
            "two": 2,
        });
    });

};
