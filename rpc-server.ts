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
import { RPCProcurement } from "./rpc/primitives/procurement";
import { RPCShipment } from "./rpc/primitives/shipment";
import { RPCTracking } from "./rpc/primitives/tracking";
import { RPCDocument } from "./rpc/primitives/document";
import { RPCProduct } from "./rpc/primitives/product";
import { RPCItem } from "./rpc/primitives/item";
import { RPCProcurementList } from "./rpc/primitives/procurement_list";
import { RPCShipmentList } from "./rpc/primitives/shipment_list";
import { RPCDocumentList } from "./rpc/primitives/document_list";
import { RPCProductList } from "./rpc/primitives/product_list";
import { RPCItemList } from "./rpc/primitives/item_list";

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
const TIMEOUT = config.get("RPC_SERVER_TIMEOUT");


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
            inject: RPCShipChainVault.InjectPrimitives,
            // Procurement Primitive
            procurement: {
                get: RPCProcurement.Get,
                fields: {
                    get: RPCProcurement.GetFields,
                    set: RPCProcurement.SetFields,
                },
                shipments: {
                    list: RPCProcurement.ListShipments,
                    get: RPCProcurement.GetShipment,
                    add: RPCProcurement.AddShipment,
                },
                documents: {
                    list: RPCProcurement.ListDocuments,
                    get: RPCProcurement.GetDocument,
                    add: RPCProcurement.AddDocument,
                },
                products: {
                    list: RPCProcurement.ListProducts,
                    get: RPCProcurement.GetProduct,
                    add: RPCProcurement.AddProduct,
                },
            },
            procurementList: {
                get: RPCProcurementList.Get,
                add: RPCProcurementList.Add,
                list: RPCProcurementList.List,
                count: RPCProcurementList.Count,
            },
            // Shipment Primitive
            shipment: {
                get: RPCShipment.Get,
                fields: {
                    get: RPCShipment.GetFields,
                    set: RPCShipment.SetFields,
                },
                documents: {
                    list: RPCShipment.ListDocuments,
                    get: RPCShipment.GetDocument,
                    add: RPCShipment.AddDocument,
                },
                tracking: {
                    get: RPCShipment.GetTracking,
                    set: RPCShipment.SetTracking,
                },
                items: {
                    list: RPCShipment.ListItems,
                    get: RPCShipment.GetItem,
                    add: RPCShipment.AddItem,
                },
            },
            shipmentList: {
                get: RPCShipmentList.Get,
                add: RPCShipmentList.Add,
                list: RPCShipmentList.List,
                count: RPCShipmentList.Count,
            },
            // Tracking Primitive
            tracking: {
                get: RPCTracking.Get,
                add: RPCTracking.Add,
            },
            // Document Primitive
            document: {
                get: RPCDocument.Get,
                set: RPCDocument.Set,
                fields: {
                    get: RPCDocument.GetFields,
                    set: RPCDocument.SetFields,
                },
                content: {
                    get: RPCDocument.GetContent,
                    set: RPCDocument.SetContent,
                },
            },
            documentList: {
                get: RPCDocumentList.Get,
                add: RPCDocumentList.Add,
                list: RPCDocumentList.List,
                count: RPCDocumentList.Count,
            },
            // Product Primitive
            product: {
                get: RPCProduct.Get,
                fields: {
                    get: RPCProduct.GetFields,
                    set: RPCProduct.SetFields,
                },
                documents: {
                    list: RPCProduct.ListDocuments,
                    get: RPCProduct.GetDocument,
                    add: RPCProduct.AddDocument,
                },
            },
            productList: {
                get: RPCProductList.Get,
                add: RPCProductList.Add,
                list: RPCProductList.List,
                count: RPCProductList.Count,
            },
            // Item Primitive
            item: {
                get: RPCItem.Get,
                fields: {
                    get: RPCItem.GetFields,
                    set: RPCItem.SetFields,
                },
                product: {
                    get: RPCItem.GetProduct,
                    set: RPCItem.SetProduct,
                },
            },
            itemList: {
                get: RPCItemList.Get,
                add: RPCItemList.Add,
                list: RPCItemList.List,
                count: RPCItemList.Count,
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
const server = new Server(methodMap);

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
    let instance = server.http().listen(PORT);
    instance.timeout = TIMEOUT * 1000
}

// Handler to close database connections
//   used on catch or interrupt signal
// =====================================
async function closeDbConnection() {
    try {
        logger.info(`Closing database connections`);
        const connection = await typeorm.getConnection();
        if (connection) {
            connection.close();
        } else {
            logger.info(`No open connections`);
        }
    } catch (typeorm_err) {
        logger.error(`Error closing database connections [${typeorm_err}]`);
    }
}

process.on('SIGINT', function() {
    logger.warn(`SIGINT received. Shutting down...`);
    closeDbConnection().then(() => {
        process.exit(0);
    }).catch(err => {
        process.exit(1);
    });
});

// Main Entrypoint
// ===============
startRpcServer().catch(err => {
    logger.error(`${err}`);
    closeDbConnection().then(() => {
        process.exit(0);
    }).catch(err => {
        process.exit(1);
    });
});
