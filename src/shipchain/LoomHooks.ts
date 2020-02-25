/*
 * Copyright 2020 ShipChain, Inc.
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

import {
    Client,
    LocalAddress,
    CryptoUtils,
    Address,
    createDefaultTxMiddleware,
    createJSONRPCClient,
    getEthereumTxHash,
    EthersSigner
} from 'loom-js'
import { AddressMapper } from 'loom-js/dist/contracts'
import { ethers } from 'ethers';


import { Logger } from '../Logger';
import { EthereumService } from '../eth/EthereumService';

const config = require('config');

const logger = Logger.get(module.filename);

export class LoomHooks {
    private static _isLoomEnvironment: boolean = false;

    static get isLoomEnvironment(): boolean {
        return this._isLoomEnvironment;
    }

    static set isLoomEnvironment(value) {
        this._isLoomEnvironment = value;
    }

    private static assertLoomEnvironment() {
        if (!this.isLoomEnvironment) {
            throw new Error('Loom Environment not configured correctly');
        }
    }

    private static async getLoomClient(): Promise<Client> {
        this.assertLoomEnvironment();
        const GETH_NODE: string = config.get('GETH_NODE');
        const writeUrl: string = GETH_NODE.replace('eth', 'rpc');
        const readUrl: string = GETH_NODE.replace('eth', 'query');
        const writeClient = createJSONRPCClient({ protocols: [{ url: writeUrl }] });
        const readClient = createJSONRPCClient({ protocols: [{ url: readUrl }] });
        return new Client('default', writeClient, readClient);
    }

    static async getOrCreateMapping(ethPrivateKey: string): Promise<string> {
        this.assertLoomEnvironment();
        const ethSigner: ethers.Signer = await EthereumService.Instance.getSigner(ethPrivateKey);
        const ethAddress: string = await ethSigner.getAddress();
        const ethLoomAddress = new Address('eth', LocalAddress.fromHexString(ethAddress));

        //@ts-ignore
        const loomEthSigner = new EthersSigner(ethSigner);
        const loomPrivateKey = CryptoUtils.generatePrivateKey();
        const loomPublicKey = CryptoUtils.publicKeyFromPrivateKey(loomPrivateKey);
        const loomClient = await LoomHooks.getLoomClient();
        loomClient.on('error', logger.error);
        // loomClient.txMiddleware = [
        //     new NonceTxMiddleware(ethLoomAddress, loomClient),
        //     //@ts-ignore
        //     new SignedEthTxMiddleware(ethSigner)
        // ];
        loomClient.txMiddleware = createDefaultTxMiddleware(loomClient, loomPrivateKey);

        try {
            const loomAddress = new Address(loomClient.chainId, LocalAddress.fromPublicKey(loomPublicKey));
            const mapper = await AddressMapper.createAsync(loomClient, loomAddress);
            await mapper.addIdentityMappingAsync(
                ethLoomAddress,
                loomAddress,
                loomEthSigner
            );
            logger.debug(`Added loom mapping for ${loomAddress.local.toString()} -> ${ethLoomAddress.local.toString()}`);
            return loomAddress.local.toString();
        } catch (err) {
            let errorToThrow = err;

            if (err.message.includes('identity mapping already exists')) {
                errorToThrow = null;
                try {
                    const mapper = await AddressMapper.createAsync(loomClient, ethLoomAddress);
                    const mapping = await mapper.getMappingAsync(ethLoomAddress);
                    logger.debug(`Existing loom mapping for ${mapping.to.local.toString()} -> ${ethLoomAddress.local.toString()}`);
                    return mapping.to.local.toString();
                } catch (err) {
                    errorToThrow = err;
                }
            }

            if (errorToThrow) {
                throw new Error(`Error mapping Loom address: ${err}`);
            }
        } finally {
            loomClient.disconnect();
        }

    }

    static getEthereumTxHash(signedTx: any, chainId: string = 'default'): string {
        this.assertLoomEnvironment();
        return getEthereumTxHash(signedTx, chainId);
    }

    static async getLoomTxHashByEventHash(txHash: string): Promise<any> {
        this.assertLoomEnvironment();
        const loomClient: Client = await LoomHooks.getLoomClient();
        // @ts-ignore
        return await loomClient._readClient.sendAsync('canonical_tx_hash', ["0", "0", txHash]);
    }
}
