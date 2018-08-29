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

import { buildSchemaValidators } from "./rpc/validators";
import { loadContractFixtures } from "./rpc/contracts";
import { RPCLoad } from "./rpc/load";
import { RPCEvent, startEventSubscriptions } from "./rpc/event";
import { RPCWallet } from "./rpc/wallet";
import { RPCTransaction } from "./rpc/transaction";
import { RPCStorageCredentials } from "./rpc/storage_credentials";

import { getRDSconfig } from "./rdsconfig";

const typeorm = require("typeorm");
const rpc = require("json-rpc2");
const process = require("process");


// We need to ignore the TSError here until this is released: https://github.com/winstonjs/winston/pull/1362
// @ts-ignore
const logger: Logger = loggers.get('engine');
const PORT = process.env.PORT || 2000;


const server = rpc.Server.$create({
    "websocket": true, // is true by default
    "headers": { // allow custom headers is empty by default
        "Access-Control-Allow-Origin": "*"
    }
});

server.on("error", function(err) {
    logger.error(`${err}`);
});


// Expose RPC Method Handlers
// ==========================
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
async function startRpcServer() {
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

startRpcServer().catch(err => {
    logger.error(`${err}`);
});
