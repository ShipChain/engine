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

require('./testLoggingConfig');

import 'mocha';
import * as typeorm from "typeorm";
import {EncryptionMethod, Wallet} from '../entity/Wallet';

import EthCrypto from 'eth-crypto';
import {EncryptorContainer} from '../entity/encryption/EncryptorContainer';

export const WalletEntityTests = function() {

    beforeAll(async () => {
        await EncryptorContainer.init();
    });


    it(`generates fresh wallets`, async () => {
        const DB = typeorm.getConnection();
        const entityRepository = DB.getRepository(Wallet);
        const wallet = await Wallet.generate_entity();

        await entityRepository.save(wallet);

        expect(wallet.id).toHaveLength(36);
    });

    it(`throws when retrieving invalid wallet`, async () => {
        let caughtError;

        try {
            caughtError = await Wallet.getById('00000000-0000-4c02-943a-b52cd25b235b');
            fail('Should not have retrieved wallet');
        } catch (err) {
            caughtError = err;
        }

        expect(caughtError).toEqual(new Error('Wallet not found'));
    });

    it(`imports wallets`, async () => {
        const DB = typeorm.getConnection();
        const source_data = Wallet.generate_identity();
        const entityRepository = DB.getRepository(Wallet);
        const wallet = await Wallet.import_entity(source_data.privateKey);
        await entityRepository.save(wallet);

        expect(wallet.id).toHaveLength(36);

        // Need to access the class-private field for the comparison
        // @ts-ignore
        expect(wallet.unlocked_private_key).toEqual(source_data.privateKey);

        expect(wallet.public_key).toEqual(source_data.publicKey);
        expect(wallet.address).toEqual(source_data.address);
    });

    it(`encrypts and decrypts messages with eth-crypto (aes-256-cbc)`, async () => {
        const wallet = await Wallet.generate_entity();

        const encrypted = await Wallet.encrypt({
            message: 'SHIPtest',
            wallet: wallet,
            method: EncryptionMethod.EthCrypto,
        });

        const decrypted = await Wallet.decrypt({
            message: encrypted,
            wallet: wallet,
            method: EncryptionMethod.EthCrypto,
        });

        expect(decrypted).toEqual('SHIPtest');
    });

    it(`encrypts and decrypts messages as objects with eth-crypto (aes-256-cbc)`, async () => {
        const wallet = await Wallet.generate_entity();

        const encrypted = await Wallet.encrypt({
            message: 'SHIPtest',
            wallet: wallet,
            asString: false,
            method: EncryptionMethod.EthCrypto,
        });

        expect(encrypted).toHaveProperty('iv');
        expect(encrypted).toHaveProperty('ephemPublicKey');
        expect(encrypted).toHaveProperty('ciphertext');
        expect(encrypted).toHaveProperty('mac');

        const decrypted = await Wallet.decrypt({
            message: encrypted,
            wallet: wallet,
            method: EncryptionMethod.EthCrypto,
        });

        expect(decrypted).toEqual('SHIPtest');
    });

    it(`encrypts and decrypts messages with sodium (x25519-xsalsa20-poly1305)`, async () => {
        const wallet = await Wallet.generate_entity();

        const encrypted = await Wallet.encrypt({
            message: 'SHIPtest',
            wallet: wallet,
            method: EncryptionMethod.NaCl,
        });

        const decrypted = await Wallet.decrypt({
            message: encrypted,
            wallet: wallet,
            method: EncryptionMethod.NaCl,
        });

        expect(decrypted).toEqual('SHIPtest');
    });

    it(`encrypts and decrypts messages as objects with sodium (x25519-xsalsa20-poly1305)`, async () => {
        const wallet = await Wallet.generate_entity();

        const encrypted = await Wallet.encrypt({
            message: 'SHIPtest',
            wallet: wallet,
            asString: false,
            method: EncryptionMethod.NaCl,
        });

        expect(encrypted).toHaveProperty('version');
        expect(encrypted).toHaveProperty('nonce');
        expect(encrypted).toHaveProperty('ephemPublicKey');
        expect(encrypted).toHaveProperty('ciphertext');

        const decrypted = await Wallet.decrypt({
            message: encrypted,
            wallet: wallet,
            method: EncryptionMethod.NaCl,
        });

        expect(decrypted).toEqual('SHIPtest');
    });

    it(`signs messages and recovers keys`, async () => {
        const wallet = await Wallet.generate_entity();

        const message = 'SHIPTest';

        const hash = EthCrypto.hash.keccak256([{value: message, type: 'string'}]);

        expect(hash).toEqual("0x6eba83aa272e398b5cddf2055bb404f84c3fd8e42dd96e80edb204f64bff73ab");

        const signed = wallet.sign_hash(hash);

        expect(Wallet.recover_signer_address(signed, hash)).toEqual(wallet.address);

        expect(Wallet.recover_signer_public_key(signed, hash)).toEqual(wallet.public_key);
    });
};
