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
import { RPCVault } from "./rpc/vault";
import { RPCLoad as RPCLoad_1_0_2 } from "./rpc/Load/1.0.2/RPCLoad";
import { RPCLoad as RPCLoad_1_1_0 } from "./rpc/Load/1.1.0/RPCLoad";
import { RPCEvent, startEventSubscriptions } from "./rpc/event";
import { RPCWallet, setupWalletEncryptionHandler } from "./rpc/wallet";
import { RPCTransaction } from "./rpc/transaction";
import { RPCStorageCredentials } from "./rpc/storage_credentials";

import { getRDSconfig } from "./rdsconfig";
import { MetricsReporter } from "./src/MetricsReporter";

const typeorm = require("typeorm");
const rpc = require("json-rpc2");
const process = require("process");


const logger: Logger = loggers.get("engine");
const metrics = MetricsReporter.Instance;
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
    "balance": RPCWallet.Balance,
});

server.expose("storage_credentials", {
    "create_hosted": RPCStorageCredentials.Create,
    "list": RPCStorageCredentials.List,
    "test": RPCStorageCredentials.TestConnectivity,
    "update": RPCStorageCredentials.Update,
});

server.expose("transaction", {
    "sign": RPCTransaction.Sign,
    "send": RPCTransaction.Send,
});

server.expose("load", {
    "create_shipment_tx": RPCLoad_1_1_0.CreateShipmentTx,
});

server.expose("load.1.1.0", {
    // Transactional methods
    "create_shipment_tx": RPCLoad_1_1_0.CreateShipmentTx,
    "set_vault_uri_tx": RPCLoad_1_1_0.SetVaultUriTx,
    "set_vault_hash_tx": RPCLoad_1_1_0.SetVaultHashTx,
    "set_carrier_tx": RPCLoad_1_1_0.SetCarrierTx,
    "set_moderator_tx": RPCLoad_1_1_0.SetModeratorTx,
    "set_in_progress_tx": RPCLoad_1_1_0.SetInProgressTx,
    "set_complete_tx": RPCLoad_1_1_0.SetCompleteTx,
    "set_canceled_tx": RPCLoad_1_1_0.SetCanceledTx,
    "fund_escrow_tx": RPCLoad_1_1_0.FundEscrowTx,
    "fund_escrow_ether_tx": RPCLoad_1_1_0.FundEscrowEtherTx,
    "fund_escrow_ship_tx": RPCLoad_1_1_0.FundEscrowShipTx,
    "release_escrow_tx": RPCLoad_1_1_0.ReleaseEscrowTx,
    "withdraw_escrow_tx": RPCLoad_1_1_0.WithdrawEscrowTx,
    "refund_escrow_tx": RPCLoad_1_1_0.RefundEscrowTx,
    // View methods
    "get_shipment_data": RPCLoad_1_1_0.GetShipmentData,
    "get_escrow_data": RPCLoad_1_1_0.GetEscrowData,
});

server.expose("load.1.0.2", {
    "create_shipment_transaction": RPCLoad_1_0_2.CreateShipmentTx,
    "update_vault_hash_transaction": RPCLoad_1_0_2.UpdateVaultHashTx,
    "fund_eth_transaction": RPCLoad_1_0_2.FundEthTx,
    "fund_cash_transaction": RPCLoad_1_0_2.FundCashTx,
    "fund_ship_transaction": RPCLoad_1_0_2.FundShipTx,
    "commit_to_shipment_transaction": RPCLoad_1_0_2.CommitToShipmentTx,
    "shipment_in_transit_transaction": RPCLoad_1_0_2.ShipmentInTransitTx,
    "carrier_complete_transaction": RPCLoad_1_0_2.CarrierCompleteTx,
    "shipper_accept_transaction": RPCLoad_1_0_2.ShipperAcceptTx,
    "shipper_cancel_transaction": RPCLoad_1_0_2.ShipperCancelTx,
    "pay_out_transaction": RPCLoad_1_0_2.PayOutTx,
    "get_shipment_details": RPCLoad_1_0_2.GetShipmentDetails,
    "get_shipment_details_continued": RPCLoad_1_0_2.GetShipmentDetailsContinued,
    "get_escrow_status": RPCLoad_1_0_2.GetEscrowStatus,
    "get_contract_flags": RPCLoad_1_0_2.GetContractFlags,
});

server.expose("vault", {
    "create": RPCVault.CreateVault,
    "get_tracking": RPCVault.GetTrackingData,
    "add_tracking": RPCVault.AddTrackingData,
    "get_shipment": RPCVault.GetShipmentData,
    "add_shipment": RPCVault.AddShipmentData,
    "get_document": RPCVault.GetDocument,
    "add_document": RPCVault.AddDocument,
    "add_document_from_s3": RPCVault.AddDocumentFromS3,
    "list_documents": RPCVault.ListDocuments,
    "verify": RPCVault.VerifyVault,
    "get_historical_shipment_data": RPCVault.GetHistoricalShipmentData,
    "get_historical_tracking_data": RPCVault.GetHistoricalTrackingData,
    "get_historical_document": RPCVault.GetHistoricalDocument,
});

server.expose("event", {
    "subscribe": RPCEvent.Subscribe,
    "unsubscribe": RPCEvent.Unsubscribe,
});

// Build Schema Validators
// Connect to TypeORM
// Start RPC Server
// =======================
async function startRpcServer() {
    await setupWalletEncryptionHandler();
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

    metrics.countAction("startRpcServer");

    logger.info(`RPC server listening on ${PORT}`);
    server.listen(PORT, "0.0.0.0");
}

startRpcServer().catch(err => {
    logger.error(`${err}`);
});
