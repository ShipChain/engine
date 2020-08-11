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

import { ethers, Transaction, utils as ethersUtils } from 'ethers';

import { DeployedContractResult } from '../AbstractEthereumService';
import { Logger } from '../../Logger';
import { EthersEthereumService } from './EthersEthereumService';
import { LoomHooks } from '../LoomHooks';
import { getDeployKey } from '../deployKey';

const config = require('config');

const logger = Logger.get(module.filename);

class LoomTxProvider extends ethers.providers.JsonRpcProvider {
    _wrapTransaction(tx: Transaction, hash?: string): ethers.providers.TransactionResponse {
        if (hash != null && ethersUtils.hexDataLength(hash) !== 32) {
            throw new Error('invalid response - sendTransaction');
        }

        let result: ethers.providers.TransactionResponse = <ethers.providers.TransactionResponse>tx;

        // Check the hash we expect is the same as the hash the server reported
        if (hash != null && tx.hash !== hash) {
            logger.silly(`Transaction hash mismatch from Provider.sendTransaction. 
            ${JSON.stringify({ expectedHash: tx.hash, returnedHash: hash })}`);
            tx.hash = hash;
        }

        result.wait = (confirmations?: number) => {
            // We know this transaction *must* exist (whether it gets mined is
            // another story), so setting an emitted value forces us to
            // wait even if the node returns null for the receipt
            if (confirmations !== 0) {
                this._emitted['t:' + tx.hash] = 'pending';
            }

            return this.waitForTransaction(tx.hash, confirmations).then((receipt) => {
                if (receipt == null && confirmations === 0) {
                    return null;
                }

                // No longer pending, allow the polling loop to garbage collect this
                this._emitted['t:' + tx.hash] = receipt.blockNumber;

                if (receipt.status === 0) {
                    const ethersLogger = new ethers.utils.Logger('LoomEthersEthereumService');
                    ethersLogger.throwError('transaction failed', ethers.utils.Logger.errors.CALL_EXCEPTION, {
                        transactionHash: tx.hash,
                        transaction: tx,
                    });
                }
                return receipt;
            });
        };

        return result;
    }
}

export class LoomEthersEthereumService extends EthersEthereumService {
    private static _deployPrivateKey: string;

    private static get asyncDeployPrivateKey() {
        return (async () => {
            if (!LoomEthersEthereumService._deployPrivateKey) {
                this._deployPrivateKey = await getDeployKey();
            }
            return this._deployPrivateKey;
        })();
    }

    constructor() {
        super(true);
        const GETH_NODE = config.get('GETH_NODE');

        logger.debug(`Connecting Ethers.js to [${GETH_NODE}]`);

        this.provider = new LoomTxProvider(
            {
                url: GETH_NODE,
            },
            {
                name: null,
                chainId: LoomHooks.chainIdNumber,
            },
        );

        this.provider.on('error', (error) => {
            logger.error(`Ethers.js Provider Error: ${error}`);
        });
    }

    // Network/Node Methods
    // ====================
    async getBalance(address): Promise<ethers.BigNumber> {
        return await super.getBalance(address.toLowerCase());
    }

    async getCode(address) {
        // Loom getCode can throw an error instead of returning 0x0
        try {
            return await super.getCode(address.toLowerCase());
        } catch (err) {
            return '0x';
        }
    }

    async getSigner(privateKey): Promise<ethers.Signer> {
        return new ethers.Wallet(privateKey, this.provider);
    }

    async getTransactionCount(address): Promise<number> {
        return await super.getTransactionCount(address.toLowerCase());
    }

    // Contract Instances and Calls
    // ============================
    async createContractInstance(abi, address, providerOrSigner?) {
        return await super.createContractInstance(abi, address.toLowerCase(), providerOrSigner);
    }

    protected async parseLogToEvent(log: ethers.providers.Log, contract: ethers.Contract) {
        const parsedEvent = await super.parseLogToEvent(log, contract);

        parsedEvent['removed'] = false;
        parsedEvent['transactionHash'] = await LoomHooks.getLoomTxHashByEventHash(parsedEvent['transactionHash']);

        return parsedEvent;
    }

    // Local Network Node Interactions
    // ===============================
    async deployContract(abi, bytecode): Promise<DeployedContractResult> {
        if (this.provider instanceof ethers.providers.JsonRpcProvider) {
            await LoomHooks.getOrCreateMapping(await LoomEthersEthereumService.asyncDeployPrivateKey);
            let wallet = new ethers.Wallet(await LoomEthersEthereumService.asyncDeployPrivateKey, this.provider);

            logger.info(`Deploying from Wallet: ${wallet.address}`);

            let factory = new ethers.ContractFactory(abi, bytecode, wallet);

            // Deploy automatically detects gasLimit and all other parameters
            // Overrides can optionally be passed as an extra parameter
            // Optional; all unspecified values will queried from the network
            let overrides = {
                gasLimit: 8000000,
            };

            let contract = await factory.deploy(overrides);

            try {
                await contract.deployed();
                let receipt: ethers.providers.TransactionReceipt = await this.provider.getTransactionReceipt(
                    contract.deployTransaction.hash,
                );
                return {
                    address: receipt.contractAddress.toLowerCase(),
                    author: wallet.address.toLowerCase(),
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
        const signer = new ethers.Wallet(await LoomEthersEthereumService.asyncDeployPrivateKey, this.provider);
        const contractWithSigner = contract.connect(signer);

        let tx = await contractWithSigner.functions[method](...args);
        await tx.wait(1);
    }

    async sendWeiFromNodeAccount(address, amount) {
        logger.silly(`Skip funding from Node Account for Loom configuration`);
        return;
    }
}
