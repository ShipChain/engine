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
import { Logger } from './src/Logger';
const logger = Logger.get(module.filename);

declare global {
    // Extend the default PropertyDescriptor with a property
    // for holding RPCMethod validation options. See rpc/decorators.ts
    interface PropertyDescriptor {
        rpcOptions?: any;
    }
}

import { buildSchemaValidators } from "./rpc/validators";
import { loadContractFixtures } from "./rpc/contracts";
import { RPCVault } from "./rpc/vault";
import { RPCShipChainVault } from "./rpc/shipchain_vault";
import { RPCShipment } from "./rpc/primitives/shipment";
import { RPCShipmentCollection } from "./rpc/primitives/shipment_collection";
import { RPCLoad as RPCLoad_1_0_2 } from "./rpc/Load/1.0.2/RPCLoad";
import { RPCLoad as RPCLoad_1_1_0 } from "./rpc/Load/1.1.0/RPCLoad";
import { RPCEvent, startEventSubscriptions } from "./rpc/event";
import { RPCWallet } from "./rpc/wallet";
import { RPCTransaction } from "./rpc/transaction";
import { RPCStorageCredentials } from "./rpc/storage_credentials";


import { getRDSconfig } from "./rdsconfig";
import { MetricsReporter } from "./src/MetricsReporter";
import { GasPriceOracle } from "./src/GasPriceOracle";

import {ShipChainEncryptorContainer} from "./src/shipchain/ShipChainEncryptorContainer"

const typeorm = require("typeorm");
const config = require('config');
import { Server, Method } from 'jayson';


const metrics = MetricsReporter.Instance;
const PORT = config.get("RPC_SERVER_PORT");


// Map RPC Method Handlers to namespaces
// -------------------------------------
const methods = {
    event: {
        subscribe: RPCEvent.Subscribe,
        unsubscribe: RPCEvent.Unsubscribe,
    },
    load: {
        create_shipment_tx: RPCLoad_1_1_0.CreateShipmentTx,
        "1.1.0": {
            //Transactional methods
            create_shipment_tx: RPCLoad_1_1_0.CreateShipmentTx,
            set_vault_uri_tx: RPCLoad_1_1_0.SetVaultUriTx,
            set_vault_hash_tx: RPCLoad_1_1_0.SetVaultHashTx,
            set_carrier_tx: RPCLoad_1_1_0.SetCarrierTx,
            set_moderator_tx: RPCLoad_1_1_0.SetModeratorTx,
            set_in_progress_tx: RPCLoad_1_1_0.SetInProgressTx,
            set_complete_tx: RPCLoad_1_1_0.SetCompleteTx,
            set_canceled_tx: RPCLoad_1_1_0.SetCanceledTx,
            fund_escrow_tx: RPCLoad_1_1_0.FundEscrowTx,
            fund_escrow_ether_tx: RPCLoad_1_1_0.FundEscrowEtherTx,
            fund_escrow_ship_tx: RPCLoad_1_1_0.FundEscrowShipTx,
            release_escrow_tx: RPCLoad_1_1_0.ReleaseEscrowTx,
            withdraw_escrow_tx: RPCLoad_1_1_0.WithdrawEscrowTx,
            refund_escrow_tx: RPCLoad_1_1_0.RefundEscrowTx,
            // View methods
            get_shipment_data: RPCLoad_1_1_0.GetShipmentData,
            get_escrow_data: RPCLoad_1_1_0.GetEscrowData,
        },
        "1.0.2": {
            create_shipment_transaction: RPCLoad_1_0_2.CreateShipmentTx,
            update_vault_hash_transaction: RPCLoad_1_0_2.UpdateVaultHashTx,
            fund_eth_transaction: RPCLoad_1_0_2.FundEthTx,
            fund_cash_transaction: RPCLoad_1_0_2.FundCashTx,
            fund_ship_transaction: RPCLoad_1_0_2.FundShipTx,
            commit_to_shipment_transaction: RPCLoad_1_0_2.CommitToShipmentTx,
            shipment_in_transit_transaction: RPCLoad_1_0_2.ShipmentInTransitTx,
            carrier_complete_transaction: RPCLoad_1_0_2.CarrierCompleteTx,
            shipper_accept_transaction: RPCLoad_1_0_2.ShipperAcceptTx,
            shipper_cancel_transaction: RPCLoad_1_0_2.ShipperCancelTx,
            pay_out_transaction: RPCLoad_1_0_2.PayOutTx,
            get_shipment_details: RPCLoad_1_0_2.GetShipmentDetails,
            get_shipment_details_continued: RPCLoad_1_0_2.GetShipmentDetailsContinued,
            get_escrow_status: RPCLoad_1_0_2.GetEscrowStatus,
            get_contract_flags: RPCLoad_1_0_2.GetContractFlags,
        },
    },
    storage_credentials: {
        create_hosted: RPCStorageCredentials.Create,
        validate_create: RPCStorageCredentials.TestAndStore,
        list: RPCStorageCredentials.List,
        test: RPCStorageCredentials.TestConnectivity,
        update: RPCStorageCredentials.Update,
    },
    transaction: {
        sign: RPCTransaction.Sign,
        send: RPCTransaction.Send,
    },
    // Backwards Compatible LOAD Vault
    vault: {
        create: RPCVault.CreateVault,
        get_tracking: RPCVault.GetTrackingData,
        add_tracking: RPCVault.AddTrackingData,
        get_shipment: RPCVault.GetShipmentData,
        add_shipment: RPCVault.AddShipmentData,
        get_document: RPCVault.GetDocument,
        add_document: RPCVault.AddDocument,
        add_document_from_s3: RPCVault.AddDocumentFromS3,
        put_document_in_s3: RPCVault.PutDocumentInS3,
        list_documents: RPCVault.ListDocuments,
        verify: RPCVault.VerifyVault,
        get_historical_shipment_data: RPCVault.GetHistoricalShipmentData,
        get_historical_tracking_data: RPCVault.GetHistoricalTrackingData,
        get_historical_document: RPCVault.GetHistoricalDocument,
    },
    // New namespace to handle many different vaults
    vaults: {
        linked: {
            get_linked_data: RPCVault.GetLinkedData,
        },
        shipchain: {
            create: RPCShipChainVault.Create,
            shipment: {
                get: RPCShipment.Get,
                set: RPCShipment.Set,
            },
            shipmentCollection: {
                get: RPCShipmentCollection.Get,
                add: RPCShipmentCollection.Add,
                list: RPCShipmentCollection.List,
                count: RPCShipmentCollection.Count,
            },
        },
    },
    wallet: {
        create_hosted: RPCWallet.Create,
        import_hosted: RPCWallet.Import,
        list: RPCWallet.List,
        balance: RPCWallet.Balance,
    },
};

// Jayson requires a flat object of methods
// ----------------------------------------
const nestedName = (k, p) => p ? `${p}.${k}` : k;
const methodMap = Object.assign(
    {},
    ...function _flatten(o, p) {
        return [].concat(...Object.keys(o)
            .map(k =>
                typeof o[k] === 'object' && !(o[k] instanceof Method) ?
                    _flatten(o[k], nestedName(k,p)) :
                    ({[nestedName(k,p)]: o[k]})
            )
        );
    }(methods)
);

// Collect RPCOptions for each method to be displayed as Help
// ----------------------------------------------------------
const helpMap = Object.assign(
    {},
    ...[].concat(
        ...Object.keys(methodMap).map(k =>
            ({[k]: methodMap[k].rpcOptions || {}})
        )
    )
);

// Build Jayson Server with flattened methodMap
// --------------------------------------------
const server = new Server(methodMap, {
    collect: false // don't collect params in a single argument
});

// Self-Documenting Help response
// ------------------------------
server.method('help', new Method({
    handler: (args, callback) => {
        if (args && args.namespace) {
            callback(null, Object.assign(
                {},
                ...[].concat(
                    ...Object.keys(helpMap).map((k: string) => {
                        if(k.match(`^${args.namespace}`)) {
                            return ({[k]: helpMap[k]})
                        }
                    })
                )
            ));
        } else {
            callback(null, helpMap);
        }
    }
}));

// Error event logger setup
// ------------------------
// @ts-ignore
server.on('response', (args, response) => {
    if (response && response.error && response.error.message) {
        logger.error(`${response.error.message}`);
    }
});

// Build Schema Validators
// Connect to TypeORM
// Start RPC Server
// =======================
async function startRpcServer() {
    logger.info(`Configuration Pulled for for ${config.util.getEnv('NODE_CONFIG_ENV')}`);

    await ShipChainEncryptorContainer.init();
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

    await GasPriceOracle.Start();

    metrics.countAction("startRpcServer");

    logger.info(`RPC server listening on ${PORT}`);
    server.http().listen(PORT);
}

startRpcServer().catch(err => {
    logger.error(`${err}`);
});
