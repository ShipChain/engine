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

import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn, BaseEntity, getConnection } from 'typeorm';
import { default as EthCrypto, Encrypted } from 'eth-crypto';
import { Logger } from '../Logger';
import { EncryptorContainer } from './encryption/EncryptorContainer';
import {
    getEncryptionPublicKey,
    naclEncrypt,
    naclDecrypt,
    NaclEncryptedData,
    X25519_XSALSA20_POLY1305_VERSION,
} from './encryption/NaClWrapper';
import { Network } from './Contract';
import { LoomHooks } from '../eth/LoomHooks';
import { cacheGet, cacheSet } from '../redis';

const EthereumTx = require('ethereumjs-tx');

const logger = Logger.get(module.filename);

const EVM_ADDRESS_CACHE_KEY = 'evmAddress';

export enum EncryptionMethod {
    EthCrypto = 0,
    NaCl = 1,
}

interface EncryptParameters {
    message: any;
    publicKey?: string;
    wallet?: Wallet;
    asString?: boolean;
    method?: EncryptionMethod;
}

interface DecryptParameters {
    message: any;
    privateKey?: string;
    wallet?: Wallet;
    method?: EncryptionMethod;
}

@Entity()
export class Wallet extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;
    @CreateDateColumn() createdDate: Date;
    @Column({ nullable: true }) title: string;
    @Column('text') public_key: string;
    @Column('text') address: string;
    @Column('text') private_key: string;

    private unlocked_private_key: string;

    get asyncEvmAddress(): Promise<string> {
        return (async () => {
            if (LoomHooks.enabled) {
                let evmAddress: string = null;

                if (this.id) {
                    evmAddress = await cacheGet(this.id, EVM_ADDRESS_CACHE_KEY);
                }

                if (!evmAddress) {
                    evmAddress = await LoomHooks.getOrCreateMapping(
                        this.unlocked_private_key ||
                            (await EncryptorContainer.defaultEncryptor.decrypt(this.private_key)),
                    );

                    if (this.id) {
                        await cacheSet(this.id, EVM_ADDRESS_CACHE_KEY, evmAddress);
                    }
                }

                return evmAddress;
            }
            return this.address;
        })();
    }

    static async getById(id: string) {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        let wallet = await repository.findOne({ id: id });

        if (!wallet) {
            throw new Error('Wallet not found');
        }

        wallet.unlocked_private_key = await EncryptorContainer.defaultEncryptor.decrypt(wallet.private_key);

        // Ensure wallet mapping is properly initialized if required
        await wallet.asyncEvmAddress;

        return wallet;
    }

    static async getByAddress(address: string) {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        let wallet = await repository.findOne({ address: address });

        if (!wallet) {
            throw new Error('Wallet not found');
        }

        wallet.unlocked_private_key = await EncryptorContainer.defaultEncryptor.decrypt(wallet.private_key);

        // Ensure wallet mapping is properly initialized if required
        await wallet.asyncEvmAddress;

        return wallet;
    }

    static async listAll(): Promise<Wallet[]> {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        return await repository
            .createQueryBuilder('wallet')
            .select([
                // "wallet.title",
                'wallet.id',
                'wallet.address',
            ])
            .getMany();
    }

    static async getCount() {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        const count = await repository.createQueryBuilder('wallet').select('COUNT(wallet.id) AS cnt').getRawMany();

        return count[0]['cnt'];
    }

    static generate_identity() {
        return EthCrypto.createIdentity();
    }

    static async generate_entity() {
        const wallet = new Wallet();
        const identity = Wallet.generate_identity();

        const encryptedPrivateKey = await EncryptorContainer.defaultEncryptor.encrypt(identity.privateKey);

        Object.assign(wallet, {
            public_key: identity.publicKey,
            private_key: encryptedPrivateKey,
            address: identity.address,
            unlocked_private_key: identity.privateKey,
        });

        // Ensure wallet mapping is properly initialized if required
        await wallet.asyncEvmAddress;

        return wallet;
    }

    static async import_entity(private_key) {
        // Validate private_key format, this throws if private_key format is not valid
        const public_key = EthCrypto.publicKeyByPrivateKey(private_key);
        const address = EthCrypto.publicKey.toAddress(public_key);

        // Try to get existing wallet by address.
        // Errors indicate Wallet does not exist and needs to be created
        try {
            return await Wallet.getByAddress(address);
        } catch (_err) {
            const wallet = new Wallet();

            const encryptedPrivateKey = await EncryptorContainer.defaultEncryptor.encrypt(private_key);

            Object.assign(wallet, {
                public_key: public_key,
                private_key: encryptedPrivateKey,
                address: address,
                unlocked_private_key: private_key,
            });

            // Ensure wallet mapping is properly initialized if required
            await wallet.asyncEvmAddress;

            return wallet;
        }
    }

    // Private key accessors
    // =====================

    private __unlocked_key(strip: boolean = false) {
        if (!this.unlocked_private_key) {
            throw new Error('Wallet not initialized properly');
        }

        return strip ? this.unlocked_private_key.slice(2) : this.unlocked_private_key;
    }

    private __unlocked_key_buffer() {
        return Buffer.from(this.__unlocked_key().slice(2), 'hex');
    }

    // Encryption
    // ==========

    static async encrypt({
        message,
        asString = true,
        publicKey = null,
        wallet = null,
        method = EncryptionMethod.EthCrypto,
    }: EncryptParameters): Promise<any> {
        if (!message) {
            throw new EncryptionError('Cannot encrypt null message');
        }
        if (!publicKey && !wallet) {
            throw new EncryptionError('Either publicKey or wallet is required');
        }
        if (publicKey && wallet) {
            throw new EncryptionError('Only one of publicKey or wallet is allowed');
        }

        switch (method) {
            case EncryptionMethod.EthCrypto: {
                let encryptedData: Encrypted | string = await EthCrypto.encryptWithPublicKey(
                    wallet ? wallet.public_key : publicKey,
                    message,
                );

                if (asString) {
                    // Generates a hex string
                    encryptedData = EthCrypto.cipher.stringify(encryptedData);
                }

                return encryptedData;
            }

            case EncryptionMethod.NaCl: {
                if (wallet) {
                    publicKey = await getEncryptionPublicKey(wallet.__unlocked_key(true));
                }
                let encryptedData: NaclEncryptedData | string = await naclEncrypt(
                    publicKey,
                    { data: message },
                    X25519_XSALSA20_POLY1305_VERSION,
                );

                if (asString) {
                    // Generates a base64 string
                    encryptedData = JSON.stringify(encryptedData);
                    encryptedData = Buffer.from(encryptedData).toString('base64');
                }

                return encryptedData;
            }

            default:
                throw new EncryptionError(`Unknown encryption method ${method}`);
        }
    }

    // Decryption
    // ==========

    static async decrypt({
        message,
        privateKey = null,
        wallet = null,
        method = EncryptionMethod.EthCrypto,
    }: DecryptParameters): Promise<any> {
        if (!message) {
            throw new EncryptionError('Cannot decrypt null message');
        }
        if (!privateKey && !wallet) {
            throw new EncryptionError('Either privateKey or wallet is required');
        }
        if (privateKey && wallet) {
            throw new EncryptionError('Only one of privateKey or wallet is allowed');
        }

        switch (method) {
            case EncryptionMethod.EthCrypto: {
                if (typeof message == 'string') {
                    message = EthCrypto.cipher.parse(message);
                }
                return EthCrypto.decryptWithPrivateKey(wallet ? wallet.__unlocked_key() : privateKey, message);
            }

            case EncryptionMethod.NaCl: {
                if (typeof message == 'string') {
                    message = Buffer.from(message, 'base64').toString('utf8');
                    message = JSON.parse(message);
                }
                return await naclDecrypt(message, wallet ? wallet.__unlocked_key(true) : privateKey);
            }

            default:
                throw new EncryptionError(`Unknown encryption method ${method}`);
        }
    }

    // Message Signing
    // ===============

    static sign_hash_with_raw_key(private_key, hash) {
        return EthCrypto.sign(private_key, hash);
    }

    static recover_signer_address(signature, hash) {
        return EthCrypto.recover(signature, hash);
    }

    static recover_signer_public_key(signature, hash) {
        return EthCrypto.recoverPublicKey(signature, hash);
    }

    sign_hash(hash) {
        return Wallet.sign_hash_with_raw_key(this.__unlocked_key(), hash);
    }

    // Contract Interaction
    // ====================
    async add_tx_params(network: Network, txParams) {
        const ethereumService = network.getEthereumService();
        const hex_i = (i) => (Number.isInteger(i) ? ethereumService.toHex(i) : i);
        return {
            nonce: hex_i(txParams.nonce || (await ethereumService.getTransactionCount(this.address))),
            chainId: txParams.chainId || (await ethereumService.getNetworkId()),
            ...txParams,
        };
    }

    sign_tx(txParams) {
        const tx = new EthereumTx(txParams);

        tx.sign(this.__unlocked_key_buffer());

        let txHash = '0x' + tx.hash().toString('hex');

        if (LoomHooks.enabled) {
            txHash = LoomHooks.getEthereumTxHash(tx.serialize());
        }

        return [tx, txHash];
    }

    async sign_and_send_tx(network: Network, txParams) {
        txParams = await this.add_tx_params(network, txParams);
        let [txSigned, txHash] = this.sign_tx(txParams);
        return await network.send_tx(txSigned);
    }

    /**
     * Prevent unlocked_private_key from being serialized to JSON
     */
    toJSON() {
        let result = {};
        for (let x of Object.keys(this)) {
            if (x !== 'unlocked_private_key') {
                result[x] = this[x];
            }
        }
        return result;
    }
}

class EncryptionError extends Error {}
