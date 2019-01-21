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

import { DBFieldEncryption } from "../Wallet";
import { Logger } from '../../Logger';

const logger = Logger.get(module.filename);
const ENV = process.env.ENV || "LOCAL";

export class NoEncryptionDBFieldEncryption extends DBFieldEncryption {

    constructor(){
        super();
        logger.warn("Encryption is disabled for Wallet Private Keys!");
    }

    private static checkUsage(){
        if(ENV !== "LOCAL"){
            throw new Error("Invalid Encryption scheme for deployment!");
        }
    }

    async decrypt(cipher_text: string): Promise<string> {
        NoEncryptionDBFieldEncryption.checkUsage();
        return cipher_text;
    }

    async encrypt(private_key: string): Promise<string> {
        NoEncryptionDBFieldEncryption.checkUsage();
        return private_key;
    }

}