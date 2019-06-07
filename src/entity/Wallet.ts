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
import EthCrypto from 'eth-crypto';
import { Logger } from '../Logger';
import { EncryptorContainer } from './encryption/EncryptorContainer';

const EthereumTx = require('ethereumjs-tx');
const Web3 = require('web3');

const logger = Logger.get(module.filename);

@Entity()
export class Wallet extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;
    @CreateDateColumn() createdDate: Date;
    @Column({ nullable: true }) title: string;
    @Column('text') public_key: string;
    @Column('text') address: string;
    @Column('text') private_key: string;

    private unlocked_private_key: string;

    static async getById(id: string) {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        let wallet = await repository.findOne({ id: id });

        if (!wallet) {
            throw new Error('Wallet not found');
        }

        wallet.unlocked_private_key = await EncryptorContainer.defaultEncryptor.decrypt(wallet.private_key);

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

        const count = await repository
            .createQueryBuilder('wallet')
            .select('COUNT(wallet.id) AS cnt')
            .getRawMany();

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

            return wallet;
        }
    }

    static async encrypt(public_key, message) {
        return await EthCrypto.encryptWithPublicKey(public_key, message);
    }

    static async encrypt_to_string(public_key, message) {
        const result = await Wallet.encrypt(public_key, message);
        return EthCrypto.cipher.stringify(result);
    }

    static async decrypt_with_raw_key(private_key, message) {
        if (typeof message == 'string') message = EthCrypto.cipher.parse(message);
        return EthCrypto.decryptWithPrivateKey(private_key, message);
    }

    static sign_hash_with_raw_key(private_key, hash) {
        return EthCrypto.sign(private_key, hash);
    }

    static recover_signer_address(signature, hash) {
        return EthCrypto.recover(signature, hash);
    }

    static recover_signer_public_key(signature, hash) {
        return EthCrypto.recoverPublicKey(signature, hash);
    }

    // static async decrypt_with_safe_key(encrypted_private_key, message) {
    //     return Wallet.decrypt_with_raw_key(Wallet.__unlock_encrypted_key(encrypted_private_key), message);
    // }
    //
    // static sign_hash_with_safe_key(encrypted_private_key, hash) {
    //     return Wallet.sign_hash_with_raw_key(Wallet.__unlock_encrypted_key(encrypted_private_key), hash);
    // }
    //
    // static async __unlock_encrypted_key(encrypted_private_key) {
    //     // always encrypt private keys at rest, and encourage encrypted keys over RPC
    // }

    private __unlocked_key() {
        if (!this.unlocked_private_key) {
            throw new Error('Wallet not initialized properly');
        }

        return this.unlocked_private_key;
    }

    private __unlocked_key_buffer() {
        return Buffer.from(this.__unlocked_key().slice(2), 'hex');
    }

    async decrypt_message(message) {
        return Wallet.decrypt_with_raw_key(this.__unlocked_key(), message);
    }

    sign_hash(hash) {
        return Wallet.sign_hash_with_raw_key(this.__unlocked_key(), hash);
    }

    async add_tx_params(network, txParams) {
        const driver = network.getDriver();
        const hex_i = i => (Number.isInteger(i) ? driver.utils.toHex(i) : i);
        return {
            nonce: hex_i(txParams.nonce || (await driver.eth.getTransactionCount(this.address))),
            chainId: txParams.chainId || (await driver.eth.net.getId()),
            ...txParams,
        };
    }

    sign_tx(txParams) {
        const tx = new EthereumTx(txParams);

        tx.sign(this.__unlocked_key_buffer());

        const txHash = '0x' + tx.hash().toString('hex');

        return [tx, txHash];
    }

    async sign_and_send_tx(network, txParams) {
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
