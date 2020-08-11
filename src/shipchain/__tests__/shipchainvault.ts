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
import { Vault } from "../../vaults/Vault";
import { Wallet } from '../../entity/Wallet';
import { CloseConnection } from "../../redis";
import { EncryptorContainer } from '../../entity/encryption/EncryptorContainer';
import { Container } from "../../vaults/Container";

const storage_driver = { driver_type: 'local', base_path: 'storage/vault-tests' };


export const ShipChainVaultTests = function() {
    let author: Wallet;

    beforeAll(async () => {
        await EncryptorContainer.init();
        author = await Wallet.generate_entity();
    });

    afterAll(async () => {
        CloseConnection();
    });

    it(`can be created`, async () => {
        /* New vault shouldn't exist yet */
        let vault = new ShipChainVault(storage_driver);
        expect(await vault.metadataFileExists()).toBe(false);

        /* And then we can write the metadata */
        await vault.getOrCreateMetadata(author);
        expect(await vault.metadataFileExists()).toBe(true);

        /* And delete it to clean up */
        await vault.deleteEverything();
        expect(await vault.metadataFileExists()).toBe(false);
    });

    it(`requires isShipChainVault in meta`, async () => {
        /* New vault shouldn't exist yet */
        let vault = new Vault(storage_driver);
        expect(await vault.metadataFileExists()).toBe(false);

        /* And then we can write the metadata */
        await vault.getOrCreateMetadata(author);
        expect(await vault.metadataFileExists()).toBe(true);

        let scVault = new ShipChainVault(storage_driver, vault.id);

        let caughtError;

        try {
            caughtError = await scVault.loadMetadata();
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError.message).toMatch(`Vault ${vault.id} is not a ShipChainVault`);
    });

    it(`Loads metadata when isShipChainVault is in meta`, async () => {
        /* New vault shouldn't exist yet */
        let vault = new ShipChainVault(storage_driver);
        expect(await vault.metadataFileExists()).toBe(false);

        /* And then we can write the metadata */
        await vault.getOrCreateMetadata(author);
        expect(await vault.metadataFileExists()).toBe(true);

        let vault2 = new ShipChainVault(storage_driver, vault.id);

        try {
            await vault2.loadMetadata();
        } catch (err) {
            fail(`Should not have thrown [${err}]`);
        }
    });

    describe(`getPrimitive`, () => {
        it(`throws if invalid primitive is retrieved`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            let caughtError;

            try {
                caughtError = await vault.getPrimitive('not_a_valid_primitive');
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Primitive type is not valid [not_a_valid_primitive]`);
        });

        it(`throws if valid, but non-existent primitive is retrieved`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            let caughtError;

            try {
                caughtError = await vault.getPrimitive('Shipment');
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Primitive Shipment does not exist in Vault ${vault.id}`);
        });

        it(`returns Container for valid Primitive that exists`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            vault.injectPrimitive('Shipment');

            let shipment = await vault.getPrimitive('Shipment');

            expect(shipment).toBeInstanceOf(Container);
            expect(shipment.meta.isPrimitive).toBeTruthy();
        });
    });

    describe(`injectPrimitive`, () => {
        it(`throws if invalid primitive is injected`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            let caughtError;

            try {
                caughtError = vault.injectPrimitive('not_a_valid_primitive');
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Primitive type is not valid [not_a_valid_primitive]`);
        });

        it(`throws if valid, but pre-existing primitive is injected`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            vault.injectPrimitive('Shipment');

            let caughtError;
            try {
                vault.injectPrimitive('Shipment');
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError.message).toMatch(`Primitive Shipment already exists in Vault ${vault.id}`);
        });

        it(`injects a valid primitive`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);

            vault.injectPrimitive('Shipment');

            let vaultMeta = vault.getPrimitive('Shipment');
            expect(vaultMeta.name).toEqual('Shipment');
            expect(vaultMeta.meta.isPrimitive).toBeTruthy();
        });

        it(`reloads a previously injected primitive`, async () => {
            let vault = new ShipChainVault(storage_driver);
            await vault.getOrCreateMetadata(author);
            vault.injectPrimitive('Shipment');
            await vault.writeMetadata(author);

            let vault2 = new ShipChainVault(storage_driver, vault.id);
            await vault2.loadMetadata();
            let vault2Meta = vault2.getPrimitive('Shipment');
            expect(vault2Meta.name).toEqual('Shipment');
            expect(vault2Meta.meta.isPrimitive).toBeTruthy();
        });
    });

};
