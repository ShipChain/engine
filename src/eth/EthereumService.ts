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

export interface TransactionEventHandlers {
    receipt?: Function;
    confirmation?: Function;
    error?: Function;
}

export interface DeployedContractResult {
    address;
    author;
    hash;
}

export abstract class EthereumService {
    protected transactionConfirmations: number = 12;

    // Network/Node Methods
    // ====================
    abstract async getBalance(address);
    abstract async getCode(address);
    abstract async getGasPrice();
    abstract async getNetworkId();
    abstract async getTransactionCount(address);

    // Contract Instances and Calls
    // ============================
    abstract async deployContract(abi, bytecode): Promise<DeployedContractResult>;
    abstract async createContractInstance(abi, address, providerOrSigner?);
    abstract async callStaticMethod(contract: any, method: string, args: any[]);
    abstract async encodeTransaction(contract: any, method: string, args: any[]);
    abstract async estimateTransaction(contract: any, method: string, args: any[]);
    abstract async sendSignedTransaction(rawTx, eventHandlers?: TransactionEventHandlers);
    abstract async getContractEvents(contract: any, fromBlock: number, eventName?: string): Promise<any[]>;

    // Local Network Node Interactions
    // ===============================
    abstract async sendWeiFromNodeAccount(address, amount);
    abstract async callContractFromNodeAccount(contract: any, method: string, args: any[]);

    // UTILITIES
    // =========
    abstract toHex(aNumber);
    abstract toBigNumber(aNumber);
    abstract unitToWei(value, unit);
    abstract weiToUnit(wei, unit);
    abstract convertBigNumbersToStrings(obj);
}
