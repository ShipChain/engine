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
import { CloseConnection as CloseRedis } from "./src/redis";
import { loadContractFixtures } from "./rpc/contracts";
import { cleanupDeployedContracts } from "./rpc/__tests__/utils";


// RPC Tests
// =========
import { RPCEventTests } from './rpc/__tests__/event';
import { RPCVaultTests } from './rpc/__tests__/vault';
import { RPCStorageCredentialsTests } from './rpc/__tests__/storage_credentials';
import { RPCTransactions } from './rpc/__tests__/transaction';
import { RPCWalletTests } from './rpc/__tests__/wallet';


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

describe('RPC', async () => {

    beforeAll(async () => {
        try {
            // read connection options from ormconfig file (or ENV variables)
            const connectionOptions = await typeorm.getConnectionOptions();
            await typeorm.createConnection(connectionOptions);
            await loadContractFixtures();
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

    describe('Events', RPCEventTests);
    describe('Vaults', RPCVaultTests);
    describe('Storage', RPCStorageCredentialsTests);
    describe('Transactions', RPCTransactions);
    describe('Wallets', RPCWalletTests);

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

});
