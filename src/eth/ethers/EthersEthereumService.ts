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

import { ethers, UnsignedTransaction, utils as ethersUtils } from 'ethers';

import { DeployedContractResult, AbstractEthereumService, TransactionEventHandlers } from '../AbstractEthereumService';
import { Logger } from '../../Logger';

const config = require('config');

const logger = Logger.get(module.filename);

export class EthersEthereumService extends AbstractEthereumService {
    protected provider: ethers.providers.Provider;

    constructor(skip?: boolean) {
        super();
        if (!skip) {
            if (config.has('GETH_NETWORK')) {
                const network = config.get('GETH_NETWORK');
                const defaultProviderOptions = {};

                logger.debug(`Connecting Ethers.js to [${network}]`);

                // Add Infura provider if we have a projectId
                if (config.has('INFURA_PROJECT_ID')) {
                    const projectId = config.get('INFURA_PROJECT_ID');
                    logger.debug(`Adding InfuraProvider [${projectId}]`);
                    defaultProviderOptions['infura'] = projectId;
                }

                // Add Etherscan provider if we have an apiKey
                if (config.has('ETHERSCAN_API_KEY')) {
                    const apiKey = config.get('ETHERSCAN_API_KEY');
                    logger.debug(`Adding EtherscanProvider [${apiKey}]`);
                    defaultProviderOptions['etherscan'] = apiKey;
                }

                // Include the default providers from Ethers.js
                this.provider = ethers.getDefaultProvider(network, defaultProviderOptions);
            } else {
                const GETH_NODE = config.get('GETH_NODE');

                logger.debug(`Connecting Ethers.js to [${GETH_NODE}]`);

                this.provider = new ethers.providers.JsonRpcProvider({
                    url: GETH_NODE,
                });

                // Development Geth POA network does not continually create blocks
                this.transactionConfirmations = 1;
            }

            this.provider.on('error', (error) => {
                logger.error(`Ethers.js Provider Error: ${error}`);
            });
        }
    }

    // Network/Node Methods
    // ====================
    async getBalance(address): Promise<ethers.BigNumber> {
        return this.convertBigNumbersToStrings(await this.provider.getBalance(address));
    }

    async getCode(address) {
        return await this.provider.getCode(address);
    }

    async getGasPrice(): Promise<ethers.BigNumber> {
        return await this.provider.getGasPrice();
    }

    async getNetworkId(): Promise<number> {
        const network = await this.provider.getNetwork();
        return network.chainId;
    }

    async getSigner(privateKey): Promise<any> {
        throw new Error(`getSigner Not Implemented for EthersEthereumService`);
    }

    async getTransactionCount(address): Promise<number> {
        return await this.provider.getTransactionCount(address);
    }

    async getTransactionReceipt(hash): Promise<ethers.providers.TransactionReceipt> {
        return await this.provider.getTransactionReceipt(hash);
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

        const functionFragment = contract.interface.getFunction(method);

        // If we have 1 additional argument, we allow transaction overrides
        if (args.length === functionFragment.inputs.length + 1) {
            tx = ethersUtils.shallowCopy(args.pop());
            for (let key in tx) {
                if (!allowedTransactionKeys[key]) {
                    throw new Error('unknown transaction override ' + key);
                }
            }
        }

        // Make sure the call matches the constructor signature
        const ethersLogger = new ethers.utils.Logger('EthersEthereumService');
        ethersLogger.checkArgumentCount(args.length, functionFragment.inputs.length, ` in ${method}`);

        // Set the data to the bytecode + the encoded constructor arguments

        //convert the uint256 arguments from string to bignumber
        for (let i = 0; i < functionFragment.inputs.length; i++) {
            if (functionFragment.inputs[i]['type'] === 'uint256') {
                args[i] = this.toBigNumber(`${args[i]}`);
            }
        }
        tx.data = contract.interface.encodeFunctionData(method, args);

        return tx;
    }

    async estimateTransaction(contract: ethers.Contract, method: string, args: any[]) {
        // Gas estimation tends to undershoot the total gas consumption
        return this.toBigNumber(2).mul(await contract.estimateGas[method](...args));
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
            const eventFragment = contract.interface.getEvent(eventName);
            filter['topics'] = [contract.interface.getEventTopic(eventFragment)];
        }

        logger.silly(`Getting Logs for '${eventName}' from block ${fromBlock}`);

        const logs: ethers.providers.Log[] = await this.provider.getLogs(filter);
        return Promise.all(logs.map((log) => this.parseLogToEvent(log, contract)));
    }

    protected async parseLogToEvent(log: ethers.providers.Log, contract: ethers.Contract) {
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

        parsedEvent['returnValues'] = parsedEvent.args;
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
            let hashSource = parsedEvent.blockHash + parsedEvent.transactionHash.replace('0x', '');

            if (parsedEvent.logIndex.toString().length % 2 == 1) {
                hashSource += '0';
            }
            hashSource += parsedEvent.logIndex.toString();

            const shaId = ethers.utils.keccak256(hashSource);
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
        if (this.provider instanceof ethers.providers.JsonRpcProvider) {
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
        if (this.provider instanceof ethers.providers.JsonRpcProvider) {
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
        if (this.provider instanceof ethers.providers.JsonRpcProvider) {
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
        return ethers.BigNumber.from(aNumber);
    }

    unitToWei(value, unit) {
        return ethers.utils.parseUnits(`${value}`, unit);
    }

    weiToUnit(wei, unit) {
        return ethers.utils.formatUnits(wei, unit);
    }

    convertBigNumbersToStrings(obj) {
        let transformedResponse: any = ethersUtils.shallowCopy(obj);

        // If this is a single value response, return string representation of number
        if (ethers.BigNumber.isBigNumber(obj)) {
            transformedResponse = obj.toString();
        }

        // scan object for BigNumber instances and return string representation of number
        else {
            for (let property of Object.keys(obj)) {
                if (obj[property] && ethers.BigNumber.isBigNumber(obj[property])) {
                    transformedResponse[property] = obj[property].toString();
                }
            }
        }

        return transformedResponse;
    }
}
