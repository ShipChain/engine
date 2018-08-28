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

// Setup logging prior to any other imports
require("./loggingConfig");
import { Logger, loggers } from "winston";

import { Wallet } from "./src/entity/Wallet";
import { StorageCredential } from "./src/entity/StorageCredential";
import { Project } from "./src/entity/Contract";
import { EventSubscription } from "./src/entity/EventSubscription";

import { LoadVault } from "./src/shipchain/LoadVault";
import { TokenContract } from "./src/shipchain/TokenContract";
import { FundingType, LoadContract } from "./src/shipchain/LoadContract";
import { TransmissionConfirmationCallback } from "./src/shipchain/TransmissionConfirmationCallback";

import { buildSchemaValidators, uuidArgumentValidator, validateShipmentArgs } from "./rpc/validators";
import { LoadedContracts } from "./rpc/loadedContracts";
import { RPCLoad } from "./rpc/load";
import { RPCEvent } from "./rpc/event";
import { RPCWallet } from "./rpc/wallet";
import { RPCTransaction } from "./rpc/transaction";
import { RPCStorageCredentials } from "./rpc/storage_credentials";


import { getRDSconfig } from "./rdsconfig";

const test_net_utils = require("./src/local-test-net-utils");

const typeorm = require("typeorm");
const rpc = require("json-rpc2");
const process = require("process");


const PORT = process.env.PORT || 2000;
const ENV = process.env.ENV || "LOCAL";


// Load Contract Fixtures from Meta-data
// =====================================
let TOKEN_CONTRACT = null;
let LOAD_CONTRACT = null;


// We need to ignore the TSError here until this is released: https://github.com/winstonjs/winston/pull/1362
// @ts-ignore
const logger: Logger = loggers.get('engine');

const loadedContracts = LoadedContracts.Instance;


async function loadContractFixtures() {

    await Project.loadFixtures("/contracts");

    if (ENV === "DEV" || ENV === "LOCAL") {
        const GETH_NODE = process.env.GETH_NODE || "localhost:8545";
        logger.info(`Loading Contracts from ${GETH_NODE}`);
        const [web3, network, token, load] = await test_net_utils.setupLocalTestNetContracts(GETH_NODE, await typeorm.getConnection().getRepository(Wallet).find());
        TOKEN_CONTRACT = new TokenContract(token.network.title, token.version.title);
        LOAD_CONTRACT = new LoadContract(load.network.title, load.version.title);
    }

    else if (ENV === "STAGE") {
        logger.info("Loading Contracts from Ropsten");
        TOKEN_CONTRACT = new TokenContract("ropsten", "1.0");
        LOAD_CONTRACT = new LoadContract("ropsten", "1.0.2");
    }

    else if (ENV === "PROD") {
        logger.info("Loading Contracts from Main");
        TOKEN_CONTRACT = new TokenContract("main", "1.0");
        LOAD_CONTRACT = new LoadContract("main", "1.0.2");
    }

    else {
        throw new Error("Unable to determine appropriate Ethereum Network!");
    }

    await TOKEN_CONTRACT.Ready;
    await LOAD_CONTRACT.Ready;

    loadedContracts.register("LOAD", LOAD_CONTRACT, true);
    loadedContracts.register("Token", TOKEN_CONTRACT, true);
}

function getCurrentContractForProject(projectName: string) {
    let contract;

    if (projectName == "LOAD") {
        contract = LOAD_CONTRACT._contract;
    } else if (projectName == "Token") {
        contract = TOKEN_CONTRACT._contract;
    } else {
        throw new Error("Invalid Project Name");
    }

    return contract;
}

async function startEventSubscriptions() {
    let eventSubscriptions: EventSubscription[] = await EventSubscription.getStartable();

    for (let eventSubscription of eventSubscriptions) {
        await eventSubscription.start(loadedContracts.get(eventSubscription.project).getContractEntity());
    }

}


// Expose RPC Method Handlers
// ==========================

const server = rpc.Server.$create({
    "websocket": true, // is true by default
    "headers": { // allow custom headers is empty by default
        "Access-Control-Allow-Origin": "*"
    }
});

function asyncRPCHandler(func) {
    return function(args, opt, callback) {
        func(args, opt).then(resolve => callback(null, resolve)).catch(reject => callback(reject));
    };
}

server.on("error", function(err) {
    logger.error(`${err}`);
});

server.expose("wallet", {
    "create_hosted": RPCWallet.Create,
    "import_hosted": RPCWallet.Import,
    "list": RPCWallet.List,
    "balance": RPCWallet.Balance
});

server.expose("storage_credentials", {
    "create_hosted": RPCStorageCredentials.Create,
    "list": RPCStorageCredentials.List
});

server.expose("transaction", {
    "sign": RPCTransaction.Sign,
    "send": RPCTransaction.Send
});

server.expose("load", {
    "create_vault": RPCLoad.CreateVault,
    "create_shipment_transaction": RPCLoad.CreateShipmentTx,
    "update_vault_hash_transaction": RPCLoad.UpdateVaultHashTx,
    "fund_eth_transaction": RPCLoad.FundEthTx,
    "fund_cash_transaction": RPCLoad.FundCashTx,
    "fund_ship_transaction": RPCLoad.FundShipTx,
    "commit_to_shipment_transaction": RPCLoad.CommitToShipmentTx,
    "shipment_in_transit_transaction": RPCLoad.ShipmentInTransitTx,
    "carrier_complete_transaction": RPCLoad.CarrierCompleteTx,
    "shipper_accept_transaction": RPCLoad.ShipperAcceptTx,
    "shipper_cancel_transaction": RPCLoad.ShipperCancelTx,
    "pay_out_transaction": RPCLoad.PayOutTx,
    "get_shipment_details": RPCLoad.GetShipmentDetails,
    "get_shipment_details_continued": RPCLoad.GetShipmentDetailsContinued,
    "get_escrow_status": RPCLoad.GetEscrowStatus,
    "get_contract_flags": RPCLoad.GetContractFlags,
    "get_tracking_data": RPCLoad.GetTrackingData,
    "add_tracking_data": RPCLoad.AddTrackingData,
    "get_shipment_data": RPCLoad.GetShipmentData,
    "add_shipment_data": RPCLoad.AddShipmentData
});

server.expose("event", {
    "subscribe": RPCEvent.Subscribe,
    "unsubscribe": RPCEvent.Unsubscribe
});

// Build Schema Validators
// Connect to TypeORM
// Start RPC Server
// =======================
async function startServer() {
    await buildSchemaValidators();

    // read connection options from ormconfig file (or ENV variables)
    const connectionOptions = await typeorm.getConnectionOptions();
    const rdsOptions = await getRDSconfig();

    await typeorm.createConnection({
        ...connectionOptions,
        ...rdsOptions
    });

    await loadContractFixtures();
    await startEventSubscriptions();

    logger.info(`RPC server listening on ${PORT}`);
    server.listen(PORT, "0.0.0.0");
}

startServer();
