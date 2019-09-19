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

import { errors, ethers } from 'ethers';
import { BigNumber, Network, shallowCopy, UnsignedTransaction } from 'ethers/utils';

import { DeployedContractResult, EthereumService, TransactionEventHandlers } from '../EthereumService';
import { JsonRpcProvider, Log } from 'ethers/providers';
import { Logger } from '../../Logger';

const config = require('config');

const logger = Logger.get(module.filename);

export class EthersEthereumService extends EthereumService {
    private readonly provider: ethers.providers.Provider;

    constructor() {
        super();
        if (config.has('GETH_NETWORK')) {
            const network = config.get('GETH_NETWORK');
            const applicableProviders: ethers.providers.BaseProvider[] = [];

            logger.debug(`Connecting Ethers.js to [${network}]`);

            // Add Infura provider if we have a projectId
            if (config.has('INFURA_PROJECT_ID')) {
                const projectId = config.get('INFURA_PROJECT_ID');

                logger.debug(`Adding InfuraProvider [${projectId}]`);
                applicableProviders.push(new ethers.providers.InfuraProvider(network, projectId));
            }

            // Add Etherscan provider if we have an apiKey
            if (config.has('ETHERSCAN_API_KEY')) {
                const apiKey = config.get('ETHERSCAN_API_KEY');

                logger.debug(`Adding EtherscanProvider [${apiKey}]`);
                applicableProviders.push(new ethers.providers.EtherscanProvider(network, apiKey));
            }

            // Include the default providers from Ethers.js
            const defaultProvider = ethers.getDefaultProvider(network);
            if (defaultProvider instanceof ethers.providers.FallbackProvider) {
                logger.debug(`Adding ${defaultProvider.providers.length} FallbackProviders`);
                applicableProviders.push(...defaultProvider.providers);
            } else {
                logger.debug(`Adding DefaultProvider`);
                applicableProviders.push(defaultProvider);
            }

            if (applicableProviders.length === 0) {
                throw new Error(`Unable to build list of Providers`);
            }

            this.provider = new ethers.providers.FallbackProvider(applicableProviders);
        } else {
            const GETH_NODE = config.get('GETH_NODE');

            logger.debug(`Connecting Ethers.js to [${GETH_NODE}]`);

            this.provider = new ethers.providers.JsonRpcProvider({
                url: GETH_NODE,
            });

            // Development Geth POA network does not continually create blocks
            this.transactionConfirmations = 1;
        }

        this.provider.on('error', error => {
            logger.error(`Ethers.js Provider Error: ${error}`);
        });
    }

    // Network/Node Methods
    // ====================
    async getBalance(address): Promise<BigNumber> {
        return this.convertBigNumbersToStrings(await this.provider.getBalance(address));
    }

    async getCode(address) {
        return await this.provider.getCode(address);
    }

    async getGasPrice(): Promise<BigNumber> {
        return await this.provider.getGasPrice();
    }

    async getNetworkId(): Promise<number> {
        const network: Network = await this.provider.getNetwork();
        return network.chainId;
    }

    async getTransactionCount(address): Promise<number> {
        return await this.provider.getTransactionCount(address);
    }

    // Contract Instances and Calls
    // ============================
    async createContractInstance(abi, address, providerOrSigner?) {
        return new ethers.Contract(address, abi, providerOrSigner || this.provider);
    }

    async callStaticMethod(contract: ethers.Contract, method: string, args: any[]) {
        return await contract.functions[method](...args);
    }

    async encodeTransaction(contract: ethers.Contract, method: string, args: any[]) {
        const allowedTransactionKeys: { [key: string]: boolean } = {
            chainId: true,
            data: true,
            from: true,
            gasLimit: true,
            gasPrice: true,
            nonce: true,
            to: true,
            value: true,
        };

        let tx: UnsignedTransaction = {};

        // If we have 1 additional argument, we allow transaction overrides
        if (args.length === contract.interface.functions[method].inputs.length + 1) {
            tx = shallowCopy(args.pop());
            for (let key in tx) {
                if (!allowedTransactionKeys[key]) {
                    throw new Error('unknown transaction override ' + key);
                }
            }
        }

        // Make sure the call matches the constructor signature
        errors.checkArgumentCount(args.length, contract.interface.functions[method].inputs.length, ` in ${method}`);

        // Set the data to the bytecode + the encoded constructor arguments
        tx.data = contract.interface.functions[method].encode(args);

        return tx;
    }

    async estimateTransaction(contract: ethers.Contract, method: string, args: any[]) {
        // Gas estimation tends to undershoot the total gas consumption
        return this.toBigNumber(2).mul(await contract.estimate[method](...args));
    }

    async sendSignedTransaction(rawTx, eventHandlers?: TransactionEventHandlers) {
        try {
            const tx = await this.provider.sendTransaction(rawTx);
            logger.debug(`Submitted Transaction ${tx.hash}`);

            // Wait for initial mine
            await tx.wait();
            logger.debug(`Transaction ${tx.hash} mined`);

            const receipt = await this.provider.getTransactionReceipt(tx.hash);
            logger.silly(`receipt ${JSON.stringify(receipt, null, 2)}`);

            // Post-byzantium blocks will have a status (0 indicated failure during execution)
            if (!receipt || (receipt.byzantium && !receipt.status)) {
                const receiptError: string = `Receipt or Status indicate Failure [${tx.hash}]`;
                logger.warn(receiptError);
                throw new Error(receiptError);
            }

            if (eventHandlers.receipt) {
                eventHandlers.receipt(this.convertBigNumbersToStrings(receipt));
            }

            if (eventHandlers.confirmation) {
                logger.silly(`${tx.hash} waiting for ${this.transactionConfirmations} confirmations`);
                let confirmation: any = tx;

                if (this.transactionConfirmations > 1) {
                    confirmation = await tx.wait(this.transactionConfirmations);
                }

                confirmation = this.convertBigNumbersToStrings(confirmation);

                logger.debug(`Transaction ${tx.hash} confirmed`);
                eventHandlers.confirmation(confirmation);
            }
        } catch (err) {
            if (eventHandlers.error) {
                eventHandlers.error(err);
            } else {
                throw err;
            }
        }
    }

    async getContractEvents(contract: ethers.Contract, fromBlock: number, eventName?: string): Promise<any[]> {
        const filter = {
            address: contract.address,
            fromBlock: fromBlock,
            toBlock: 'latest',
        };
        if (eventName != 'allEvents') {
            filter['topics'] = [contract.interface.events[eventName].topic];
        }

        logger.silly(`Getting Logs for '${eventName}' from block ${fromBlock}`);

        const logs: Log[] = await this.provider.getLogs(filter);
        return logs.map(log => this.parseLogToEvent(log, contract));
    }

    private parseLogToEvent(log: Log, contract: ethers.Contract) {
        // Engine already interchanges Event data with the Transmission project in a specific format (from web3)
        // These modifications are to retain that existing format until (if) Transmission models are modified

        let parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data,
        });

        let parsedEvent = {
            id: null,
            ...log,
            ...parsedLog,
        };

        parsedEvent['returnValues'] = parsedEvent.values;
        parsedEvent['event'] = parsedLog.name;
        parsedEvent['signature'] = parsedLog.topic;
        parsedEvent['raw'] = {
            data: log.data === '0x' ? null : log.data,
            topics: log.topics,
        };

        if (
            typeof parsedEvent.blockHash === 'string' &&
            typeof parsedEvent.transactionHash === 'string' &&
            typeof parsedEvent.logIndex === 'number'
        ) {
            const shaId = ethers.utils.keccak256(
                parsedEvent.blockHash + parsedEvent.transactionHash.replace('0x', '') + parsedEvent.logIndex.toString(),
            );

            parsedEvent.id = `log_${shaId.replace('0x', '').substr(0, 8)}`;
        }

        delete parsedEvent['data'];
        delete parsedEvent['topics'];
        delete parsedEvent['topic'];
        delete parsedEvent['values'];

        parsedEvent['returnValues'] = this.convertBigNumbersToStrings(parsedEvent['returnValues']);

        return parsedEvent;
    }

    // Local Network Node Interactions
    // ===============================
    async deployContract(abi, bytecode): Promise<DeployedContractResult> {
        if (this.provider instanceof JsonRpcProvider) {
            const accounts = await this.provider.listAccounts();
            const deployerAccount = accounts[0];

            let factory = new ethers.ContractFactory(abi, bytecode, this.provider.getSigner(deployerAccount));

            // Deploy automatically detects gasLimit and all other parameters
            // Overrides can optionally be passed as an extra parameter
            // Optional; all unspecified values will queried from the network
            let overrides = {
                gasLimit: 8000000,
            };

            let contract = await factory.deploy(overrides);

            try {
                await contract.deployed();
                logger.debug(`Deploy Address: ${contract.address}`);
                return {
                    address: contract.address,
                    author: deployerAccount,
                    hash: contract.deployTransaction.hash,
                };
            } catch (error) {
                logger.error('Failed to deploy in TX:', error.transactionHash);
                throw error;
            }
        } else {
            throw new Error(`Deployments via non-JsonRpcProvider not yet supported`);
        }
    }

    async callContractFromNodeAccount(contract: ethers.Contract, method: string, args: any[]) {
        if (this.provider instanceof JsonRpcProvider) {
            const accounts = await this.provider.listAccounts();
            const deployerAccount = accounts[0];

            const signer = this.provider.getSigner(deployerAccount);
            const contractWithSigner = contract.connect(signer);

            let tx = await contractWithSigner.functions[method](...args);
            await tx.wait(1);
        } else {
            throw new Error(`Unlocked Account calls via non-JsonRpcProvider not supported`);
        }
    }

    async sendWeiFromNodeAccount(address, amount) {
        if (this.provider instanceof JsonRpcProvider) {
            const accounts = await this.provider.listAccounts();
            const deployerAccount = accounts[0];

            const signer = this.provider.getSigner(deployerAccount);

            let transfer = {
                to: address,
                value: amount,
            };

            let tx = await signer.sendTransaction(transfer);
            await tx.wait(1);
        } else {
            throw new Error(`Unlocked Account calls via non-JsonRpcProvider not supported`);
        }
    }

    // UTILITIES
    // =========
    toHex(aNumber) {
        return ethers.utils.hexlify(aNumber);
    }

    toBigNumber(aNumber) {
        return ethers.utils.bigNumberify(aNumber);
    }

    unitToWei(value, unit) {
        return ethers.utils.parseUnits(`${value}`, unit);
    }

    weiToUnit(wei, unit) {
        return ethers.utils.formatUnits(wei, unit);
    }

    convertBigNumbersToStrings(obj) {
        let transformedResponse: any = shallowCopy(obj);

        // If this is a single value response, there's no nested properties
        if (Object.keys(obj).length === 1 && obj.hasOwnProperty('_hex')) {
            transformedResponse = this.toBigNumber(obj).toString();
        }

        // ethers returns uint256 values as {"_hex": "0x00"}
        for (let property of Object.keys(obj)) {
            if (obj[property] && Object.keys(obj[property]).length === 1 && obj[property].hasOwnProperty('_hex')) {
                transformedResponse[property] = this.toBigNumber(obj[property]).toString();
            }
        }

        return transformedResponse;
    }
}
