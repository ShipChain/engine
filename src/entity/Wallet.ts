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

const EthereumTx = require('ethereumjs-tx');
const Web3 = require('web3');

@Entity()
export class Wallet extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @CreateDateColumn() createdDate: Date;

    @Column({ nullable: true })
    title: string;

    @Column('text') public_key: string;

    @Column('text') address: string;

    // TODO: would be best to store this encrypted at rest
    // and use a config-level encryption key to decrypt on demand
    @Column('text') private_key: string;

    static async getById(id: string) {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        let wallet = await repository.findOne({ id: id });

        if (!wallet) {
            throw new Error('Wallet not found');
        }

        return wallet;
    }

    static async getByPrivateKey(private_key: string) {
        const DB = getConnection();
        const repository = DB.getRepository(Wallet);

        let wallet = await repository.findOne({ private_key: private_key });

        if (!wallet) {
            throw new Error('Wallet not found');
        }

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

    static generate_identity() {
        return EthCrypto.createIdentity();
    }

    static generate_entity() {
        const wallet = new Wallet();
        const identity = Wallet.generate_identity();

        Object.assign(wallet, {
            public_key: identity.publicKey,
            private_key: identity.privateKey,
            address: identity.address,
        });

        return wallet;
    }

    static async import_entity(private_key) {
        try {
            return await Wallet.getByPrivateKey(private_key);
        } catch (_err) {
            const wallet = new Wallet();
            // TODO: Validate private_key format
            const public_key = EthCrypto.publicKeyByPrivateKey(private_key);
            const address = EthCrypto.publicKey.toAddress(public_key);
            Object.assign(wallet, {
                public_key: public_key,
                private_key: private_key,
                address: address,
            });

            return wallet;
        }
    }

    static async encrypt(public_key, message) {
        const result = await EthCrypto.encryptWithPublicKey(public_key, message);
        result.to_string = EthCrypto.cipher.stringify(result);
        return result;
    }

    static async __unlock_encrypted_key(encrypted_private_key) {
        // TODO always encrypt private keys at rest, and encourage encrypted keys over RPC
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

    static async decrypt_with_safe_key(encrypted_private_key, message) {
        return Wallet.decrypt_with_raw_key(Wallet.__unlock_encrypted_key(encrypted_private_key), message);
    }

    static sign_hash_with_safe_key(encrypted_private_key, hash) {
        return Wallet.sign_hash_with_raw_key(Wallet.__unlock_encrypted_key(encrypted_private_key), hash);
    }

    __unlocked_key() {
        // TODO always encrypt private keys at rest
        return this.private_key;
    }

    __unlocked_key_buffer() {
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
        const hex_i = i => (Number.isInteger(i) ? Web3.utils.toHex(i) : i);
        return {
            nonce: hex_i(txParams.nonce || (await driver.eth.getTransactionCount(this.address))),
            chainId: txParams.chainId || (await driver.eth.net.getId()),
            ...txParams,
        };
    }

    sign_tx(txParams) {
        const tx = new EthereumTx(txParams);

        tx.sign(this.__unlocked_key_buffer());

        return tx;
    }

    async sign_and_send_tx(network, txParams) {
        txParams = await this.add_tx_params(network, txParams);

        return await network.send_tx(this.sign_tx(txParams));
    }
}
