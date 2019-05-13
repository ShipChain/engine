/*
 * Copyright 2018 ShipChain, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { AwsPrivateKeyDBFieldEncryption } from './AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';
import { DBFieldEncryption } from '../entity/encryption/DBFieldEncryption';
import _default from 'eth-crypto';

const ENV = process.env.ENV || 'LOCAL';

export class EncryptorContainer {
    /**
     * This class may contain more types of encryptors. Or we can get encryptor
     * by its type name later
     */
    static _defaultEncryptorOfStage: DBFieldEncryption = null;

    static get defaultEncryptorOfStage(): DBFieldEncryption {
        if (this._defaultEncryptorOfStage == null) {
            throw new Error('EncryptorContainer init function not called!');
        } else {
            return this._defaultEncryptorOfStage;
        }
    }

    static async init() {
        if (ENV === 'DEV' || ENV === 'STAGE' || ENV === 'DEMO' || ENV === 'PROD') {
            this._defaultEncryptorOfStage = await AwsPrivateKeyDBFieldEncryption.getInstance();
        } else {
            this._defaultEncryptorOfStage = await PrivateKeyDBFieldEncryption.getInstance();
        }
    }
}
