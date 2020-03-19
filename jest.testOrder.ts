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


require('./src/__tests__/testLoggingConfig');

import 'mocha';
import * as typeorm from "typeorm";
const nock = require('nock');
const fs = require('fs');
import { CloseConnection as CloseRedis } from "./src/redis";
import { loadContractFixtures } from "./rpc/contracts";
import { cleanupDeployedContracts } from "./rpc/__tests__/utils";

import { EncryptorContainer } from "./src/entity/encryption/EncryptorContainer";
import { Wallet } from "./src/entity/Wallet";


// RPC Tests
// =========
import { RPCEventTests } from './rpc/__tests__/event';
import { RPCVaultTests } from './rpc/__tests__/vault';
import { RPCStorageCredentialsTests } from './rpc/__tests__/storage_credentials';
import { RPCTransactions } from './rpc/__tests__/transaction';
import { RPCWalletTests } from './rpc/__tests__/wallet';
import { RPCShipChainVaultTests } from './rpc/__tests__/shipchainvault';
import { RPCDocumentPrimitiveTests } from './rpc/__tests__/primitives/document';
import { RPCDocumentListPrimitiveTests } from './rpc/__tests__/primitives/document_list';
import { RPCItemPrimitiveTests } from './rpc/__tests__/primitives/item';
import { RPCItemListPrimitiveTests } from './rpc/__tests__/primitives/item_list';
import { RPCProductPrimitiveTests } from './rpc/__tests__/primitives/product';
import { RPCProductListPrimitiveTests } from './rpc/__tests__/primitives/product_list';
import { RPCTrackingPrimitiveTests } from './rpc/__tests__/primitives/tracking';
import { RPCTelemetryPrimitiveTests } from './rpc/__tests__/primitives/telemetry';
import { RPCShipmentPrimitiveTests } from './rpc/__tests__/primitives/shipment';
import { RPCShipmentListPrimitiveTests } from './rpc/__tests__/primitives/shipment_list';
import { RPCProcurementPrimitiveTests } from './rpc/__tests__/primitives/procurement';
import { RPCProcurementListPrimitiveTests } from './rpc/__tests__/primitives/procurement_list';


// SRC Tests
// =========
import { ContractEntityTests } from './src/__tests__/contracts';
import { StorageCredentialEntityTests } from './src/__tests__/credentials';
import { EventSubscriptionEntityTests } from './src/__tests__/eventsubscriptions';
import { StorageDriverTests } from './src/__tests__/storage';
import { VaultTests } from './src/__tests__/vaults';
import { WalletEntityTests } from './src/__tests__/wallets';
import { GasPriceOracleTests } from "./src/__tests__/gaspriceoracle";
import { EventSubscriptionPostsTests } from "./src/__tests__/eventSubscriptionPosts";
import { UtilsTests } from "./src/__tests__/utils";


// ShipChain Tests
// ===============
import { LoadVaultTests } from './src/shipchain/__tests__/loadvault';
import { ShipChainVaultTests } from "./src/shipchain/__tests__/shipchainvault";
import { DocumentPrimitiveTests } from "./src/shipchain/__tests__/document";
import { DocumentListPrimitiveTests } from "./src/shipchain/__tests__/documentlist";
import { ItemPrimitiveTests } from "./src/shipchain/__tests__/item";
import { ItemListPrimitiveTests } from "./src/shipchain/__tests__/itemlist";
import { ProductPrimitiveTests } from "./src/shipchain/__tests__/product";
import { ProductListPrimitiveTests } from "./src/shipchain/__tests__/productlist";
import { TrackingPrimitiveTests } from "./src/shipchain/__tests__/tracking";
import { TelemetryPrimitiveTests } from "./src/shipchain/__tests__/telemetry";
import { ShipmentPrimitiveTests } from "./src/shipchain/__tests__/shipment";
import { ShipmentListPrimitiveTests } from "./src/shipchain/__tests__/shipmentlist";
import { ProcurementPrimitiveTests } from "./src/shipchain/__tests__/procurement";
import { ProcurementListPrimitiveTests } from "./src/shipchain/__tests__/procurementlist";
import { RPCVaultNotaryTests } from './rpc/__tests__/notary';

const CONTRACT_METADATA_URL = 'https://s3.amazonaws.com';
const CONTRACT_METADATA_PATH = '/shipchain-contracts/meta.json';
const STATIC_TEST_METADATA_FILE = '/app/src/__tests__/meta.json';


jest.setTimeout(40000);


describe('RPC', async () => {

    beforeAll(async () => {
        try {
            const staticTestMetadata = await JSON.parse(fs.readFileSync(STATIC_TEST_METADATA_FILE));
            const staticTestMetadataNock = nock(CONTRACT_METADATA_URL).get(CONTRACT_METADATA_PATH).reply(200, staticTestMetadata);

            // read connection options from ormconfig file (or ENV variables)
            const connectionOptions = await typeorm.getConnectionOptions();
            await typeorm.createConnection(connectionOptions);
            await EncryptorContainer.init();
            const rootWallet = await Wallet.import_entity('0x0000000000000000000000000000000000000000000000000000000000000001');
            await typeorm
                .getConnection()
                .getRepository(Wallet).insert(rootWallet);
            await loadContractFixtures();
            if (!staticTestMetadataNock.isDone()) {
                console.error(`Failed to load static metadata from ${STATIC_TEST_METADATA_FILE}`);
                process.exit(1);
            }
        } catch(err){
            console.error(`beforeAll Error ${err}`);
        }
    }, 120000);

    afterAll(async() => {
        try {
            await cleanupDeployedContracts(typeorm);
            let conn = await typeorm.getConnection();
            await conn.close();
            await CloseRedis();
        } catch(err){
            console.error(`afterAll Error ${err}`);
        }
    }, 10000);

    describe('Events', RPCEventTests);
    describe('Vaults', RPCVaultTests);
    describe('Notary', RPCVaultNotaryTests);
    describe('Storage', RPCStorageCredentialsTests);
    describe('Transactions', RPCTransactions);
    describe('Wallets', RPCWalletTests);
    describe('ShipChainVault', RPCShipChainVaultTests);
    describe('Document Primitive', RPCDocumentPrimitiveTests);
    describe('DocumentList Primitive', RPCDocumentListPrimitiveTests);
    describe('Item Primitive', RPCItemPrimitiveTests);
    describe('ItemList Primitive', RPCItemListPrimitiveTests);
    describe('Product Primitive', RPCProductPrimitiveTests);
    describe('ProductList Primitive', RPCProductListPrimitiveTests);
    describe('Tracking Primitive', RPCTrackingPrimitiveTests);
    describe('Telemetry Primitive', RPCTelemetryPrimitiveTests);
    describe('Shipment Primitive', RPCShipmentPrimitiveTests);
    describe('ShipmentList Primitive', RPCShipmentListPrimitiveTests);
    describe('Procurement Primitive', RPCProcurementPrimitiveTests);
    describe('ProcurementList Primitive', RPCProcurementListPrimitiveTests);

});

describe('Core', async () => {
    beforeAll(async () => {
        try {
            // read connection options from ormconfig file (or ENV variables)
            const connectionOptions = await typeorm.getConnectionOptions();
            await typeorm.createConnection(connectionOptions);
        } catch(err){
            console.error(`beforeAll Error ${err}`);
        }
    }, 10000);

    afterAll(async() => {
        try {
            await cleanupDeployedContracts(typeorm);
            let conn = await typeorm.getConnection();
            await conn.close();
            await CloseRedis();
        } catch(err){
            console.error(`afterAll Error ${err}`);
        }
    }, 10000);

    describe('Contracts', ContractEntityTests);
    describe('StorageCredentials', StorageCredentialEntityTests);
    describe('EventSubscriptions', EventSubscriptionEntityTests);
    describe('StorageDriver', StorageDriverTests);
    describe('Vaults', VaultTests);
    describe('Wallets', WalletEntityTests);
    describe('GasPriceOracle', GasPriceOracleTests);
    describe('EventSubscriptionPosts', EventSubscriptionPostsTests);
    describe('Utils', UtilsTests);

});

describe('ShipChain', async () => {
    beforeAll(async () => {
        try {
            // read connection options from ormconfig file (or ENV variables)
            const connectionOptions = await typeorm.getConnectionOptions();
            await typeorm.createConnection(connectionOptions);
        } catch(err){
            console.error(`beforeAll Error ${err}`);
        }
    }, 10000);

    afterAll(async() => {
        try {
            await cleanupDeployedContracts(typeorm);
            let conn = await typeorm.getConnection();
            await conn.close();
            await CloseRedis();
        } catch(err){
            console.error(`afterAll Error ${err}`);
        }
    }, 10000);

    describe('LOAD Vault', LoadVaultTests);
    describe('ShipChain Vault', ShipChainVaultTests);
    describe('Document Primitive', DocumentPrimitiveTests);
    describe('DocumentList Primitive', DocumentListPrimitiveTests);
    describe('Item Primitive', ItemPrimitiveTests);
    describe('ItemList Primitive', ItemListPrimitiveTests);
    describe('Product Primitive', ProductPrimitiveTests);
    describe('ProductList Primitive', ProductListPrimitiveTests);
    describe('Tracking Primitive', TrackingPrimitiveTests);
    describe('Telemetry Primitive', TelemetryPrimitiveTests);
    describe('Shipment Primitive', ShipmentPrimitiveTests);
    describe('ShipmentList Primitive', ShipmentListPrimitiveTests);
    describe('Procurement Primitive', ProcurementPrimitiveTests);
    describe('Procurement List Primitive', ProcurementListPrimitiveTests);

});
