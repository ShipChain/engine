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

import EthCrypto from 'eth-crypto';
import { DBFieldEncryption } from '../Wallet';

const LOCAL_SECRET_KEY =
    process.env.LOCAL_SECRET_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';

export class PrivateKeyDBFieldEncryption extends DBFieldEncryption {
    protected static _instance: PrivateKeyDBFieldEncryption;

    protected masterPrivateKey: string;
    protected masterPublicKey: string;

    static async getInstance(): Promise<DBFieldEncryption> {
        if (!this._instance) {
            let instance = new PrivateKeyDBFieldEncryption();

            instance.masterPrivateKey = await instance.getMasterPrivateKey();
            instance.masterPublicKey = EthCrypto.publicKeyByPrivateKey(instance.masterPrivateKey);

            this._instance = instance;
        }

        return this._instance;
    }

    async decrypt(cipher_text: string): Promise<string> {
        const encrypted = await EthCrypto.cipher.parse(cipher_text);
        return await EthCrypto.decryptWithPrivateKey(this.masterPrivateKey, encrypted);
    }

    async encrypt(private_key: string): Promise<string> {
        const encrypted = await EthCrypto.encryptWithPublicKey(this.masterPublicKey, private_key);
        return EthCrypto.cipher.stringify(encrypted);
    }

    protected async getMasterPrivateKey(): Promise<string> {
        return LOCAL_SECRET_KEY;
    }
}
