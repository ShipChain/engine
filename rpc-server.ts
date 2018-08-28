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
import { RPCWallet } from "./rpc/wallet";
import { RPCTransaction } from "./rpc/transaction";


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
    "create_hosted": asyncRPCHandler(async (args) => {
        const credentials = StorageCredential.generate_entity(args[0]);

        await credentials.save();

        return {
            success: true,
            credentials: {
                id: credentials.id,
                title: credentials.title,
                driver_type: credentials.driver_type,
                base_path: credentials.base_path
            }
        };
    }),
    "list": asyncRPCHandler(async (args) => {
        const storageCredentials: StorageCredential[] = await StorageCredential.listAll();

        return {
            success: true,
            credentials: storageCredentials
        };
    })
});

server.expose("transaction", {
    "sign": RPCTransaction.Sign,
    "send": RPCTransaction.Send
});

server.expose("load", {
    "create_vault": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "StorageCredentials",
            1: "Shipper Wallet",
            2: "Carrier Wallet"
        });

        const storage = await StorageCredential.getOptionsById(args[0]);
        const shipperWallet = await Wallet.getById(args[1]);
        const carrierWallet = await Wallet.getById(args[2]);

        const vault = new LoadVault(storage);
        await vault.getOrCreateMetadata(shipperWallet);
        await vault.authorize(shipperWallet, "owners", carrierWallet.public_key);
        const signature = await vault.writeMetadata(shipperWallet);

        return {
            success: true,
            vault_id: vault.id,
            vault_signed: signature
        };
    }),

    "create_shipment_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet",
            1: "Carrier Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const carrierWallet = await Wallet.getById(args[1]);
        const validUntil: number = args[2];
        const fundingType: FundingType = args[3];
        const shipmentAmount: number = args[4];

        const txUnsigned = await LOAD_CONTRACT.createNewShipmentTransaction(shipperWallet, carrierWallet, validUntil, fundingType, shipmentAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "update_vault_hash_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper/Carrier Wallet"
        });

        const shipperCarrierWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];
        const url: string = args[2];
        const hash: string = args[3];

        if (url.length > 2000) {
            throw new Error("URL too long");
        }
        if (hash.length != 66 || !hash.startsWith("0x")) {
            throw new Error("Invalid vault hash format");
        }

        const txUnsigned = await LOAD_CONTRACT.updateVault(shipperCarrierWallet, shipmentId, url, hash);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "fund_eth_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];
        const depositAmount = args[2];

        const txUnsigned = await LOAD_CONTRACT.depositEthTransaction(shipperWallet, shipmentId, depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "fund_cash_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];
        const depositAmount = args[2];

        const txUnsigned = await LOAD_CONTRACT.depositCashTransaction(shipperWallet, shipmentId, depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "fund_ship_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];
        const depositAmount = args[2];

        const txUnsigned = await LOAD_CONTRACT.depositShipTransaction(TOKEN_CONTRACT, shipperWallet, shipmentId, depositAmount);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "commit_to_shipment_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Carrier/Moderator Wallet"
        });

        const carrierModeratorWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.commitToShipmentContract(carrierModeratorWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "shipment_in_transit_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Carrier/Moderator Wallet"
        });

        const carrierModeratorWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.inTransitByCarrier(carrierModeratorWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),


    "carrier_complete_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Carrier/Moderator Wallet"
        });

        const carrierModeratorWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.contractCompletedByCarrier(carrierModeratorWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),


    "shipper_accept_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.contractAcceptedByShipper(shipperWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),


    "shipper_cancel_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Shipper Wallet"
        });

        const shipperWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.contractCancelledByShipper(shipperWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),


    "pay_out_transaction": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "Carrier/Moderator Wallet"
        });

        const carrierModeratorWallet = await Wallet.getById(args[0]);
        const shipmentId = args[1];

        const txUnsigned = await LOAD_CONTRACT.payOut(carrierModeratorWallet, shipmentId);

        return {
            success: true,
            transaction: txUnsigned
        };
    }),

    "get_shipment_details": asyncRPCHandler(async (args) => {
        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetails(args[0])
        };
    }),

    "get_shipment_details_continued": asyncRPCHandler(async (args) => {
        return {
            success: true,
            details: await LOAD_CONTRACT.getShipmentDetailsContinued(args[0])
        };
    }),

    "get_escrow_status": asyncRPCHandler(async (args) => {
        return {
            success: true,
            status: await LOAD_CONTRACT.getEscrowStatus(args[0])
        };
    }),

    "get_contract_flags": asyncRPCHandler(async (args) => {
        return {
            success: true,
            flags: await LOAD_CONTRACT.getContractFlags(args[0])
        };
    }),

    "get_tracking_data": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "StorageCredentials",
            1: "Wallet",
            2: "Load"
        });

        const storage = await StorageCredential.getOptionsById(args[0]);
        const wallet = await Wallet.getById(args[1]);
        const load_id = args[2];

        const load = new LoadVault(storage, load_id);
        const contents = await load.getTrackingData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: load_id,
            contents: contents
        };
    }),

    "add_tracking_data": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "StorageCredentials",
            1: "Wallet",
            2: "Load"
        });

        const storage = await StorageCredential.getOptionsById(args[0]);
        const wallet = await Wallet.getById(args[1]);
        const load_id = args[2];
        const payload = args[3];

        if (!payload || payload == "") {
            throw new Error("Invalid Payload provided");
        }

        const load = new LoadVault(storage, load_id);

        await load.getOrCreateMetadata(wallet);
        await load.addTrackingData(wallet, payload);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature
        };
    }),

    "get_shipment_data": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "StorageCredentials",
            1: "Wallet",
            2: "Load"
        });

        const storage = await StorageCredential.getOptionsById(args[0]);
        const wallet = await Wallet.getById(args[1]);
        const load_id = args[2];

        const load = new LoadVault(storage, load_id);
        const contents = await load.getShipmentData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: load_id,
            shipment: contents
        };
    }),

    "add_shipment_data": asyncRPCHandler(async (args) => {
        uuidArgumentValidator(args, {
            0: "StorageCredentials",
            1: "Wallet",
            2: "Load"
        });

        validateShipmentArgs(args[3]);

        const storage = await StorageCredential.getOptionsById(args[0]);
        const wallet = await Wallet.getById(args[1]);
        const load_id = args[2];
        const shipment = args[3];

        const load = new LoadVault(storage, load_id);

        await load.getOrCreateMetadata(wallet);
        await load.addShipmentData(wallet, shipment);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature
        };
    })
});

server.expose("event", {
    "subscribe": asyncRPCHandler(async (args) => {

        const eventSubscription = await EventSubscription.getOrCreate(args[0]);

        await eventSubscription.start(getCurrentContractForProject(eventSubscription.project));

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url
            }
        };
    }),

    "unsubscribe": asyncRPCHandler(async (args) => {

        const eventSubscription = await EventSubscription.unsubscribe(args[0]);

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url
            }
        };
    })
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
