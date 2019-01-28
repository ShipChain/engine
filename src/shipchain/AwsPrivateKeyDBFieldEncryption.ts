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

import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';
import { DBFieldEncryption } from '../entity/Wallet';
import EthCrypto from 'eth-crypto';
import { getAwsSecret } from './utils';

const ENV = process.env.ENV || 'LOCAL';

export class AwsPrivateKeyDBFieldEncryption extends PrivateKeyDBFieldEncryption {
    static async getInstance(): Promise<DBFieldEncryption> {
        if (!this._instance) {
            let instance = new AwsPrivateKeyDBFieldEncryption();

            instance.masterPrivateKey = await instance.getMasterPrivateKey();
            instance.masterPublicKey = EthCrypto.publicKeyByPrivateKey(instance.masterPrivateKey);

            this._instance = instance;
        }

        return this._instance;
    }

    protected async getMasterPrivateKey(): Promise<string> {
        let secret = await getAwsSecret('ENGINE_SECRET_KEY_' + ENV);
        return secret.SECRET_KEY;
    }
}
