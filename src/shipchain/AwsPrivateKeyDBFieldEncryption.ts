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

import { DBFieldEncryption } from '../entity/encryption/DBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';
import EthCrypto from 'eth-crypto';
import { getAwsSecret } from './utils';
const config = require('config');
const ENVIRONMENT = config.util.getEnv('NODE_CONFIG_ENV');
const IS_DEPLOYED_STAGE = config.get('IS_DEPLOYED_STAGE');

export class AwsPrivateKeyDBFieldEncryption extends PrivateKeyDBFieldEncryption {
    static async getInstance(): Promise<DBFieldEncryption> {
        if (!IS_DEPLOYED_STAGE) {
            throw new Error(`AwsPrivateKeyDBFieldEncryption only allowed in deployed environments`);
        }

        if (!this._instance) {
            let instance = new AwsPrivateKeyDBFieldEncryption();

            instance.masterPrivateKey = await instance.getMasterPrivateKey();
            instance.masterPublicKey = EthCrypto.publicKeyByPrivateKey(instance.masterPrivateKey);

            this._instance = instance;
        }

        return this._instance;
    }

    protected async getMasterPrivateKey(): Promise<string> {
        let secret = await getAwsSecret(`ENGINE_SECRET_KEY_${ENVIRONMENT}`);
        return secret.SECRET_KEY;
    }
}
