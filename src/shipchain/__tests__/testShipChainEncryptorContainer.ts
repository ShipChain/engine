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

require('../../__tests__/testLoggingConfig');

import 'mocha'

import '../ShipChainEncryptorContainer'
import { ShipChainEncryptorContainer } from '../ShipChainEncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from '../../shipchain/AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../../entity/encryption/PrivateKeyDBFieldEncryption'

export const LoadVaultTests = async function() {
    afterEach(async () => {
        ShipChainEncryptorContainer.defaultEncryptor = null;
    });

    describe("ShipChainEncryptorContainer", () => {
        it("should throw an error when calling the getter while the defaultEncrptor is null",  () => {
              expect(() => {return ShipChainEncryptorContainer.defaultEncryptor}).toThrow(Error);
            
        });

        it("should have the right type after set", () => {
            const oldENV = process.env.ENV;
            process.env.ENV = 'LOCAL';
            ShipChainEncryptorContainer.init();
            expect(ShipChainEncryptorContainer.defaultEncryptor instanceof PrivateKeyDBFieldEncryption).toEqual(true);
            process.env.ENV = oldENV;
        });

        it("should have the right type after set", () => {
            const oldENV = process.env.ENV;
            process.env.ENV = 'DEV';
            ShipChainEncryptorContainer.init();
            expect(ShipChainEncryptorContainer.defaultEncryptor instanceof AwsPrivateKeyDBFieldEncryption).toEqual(true);
            process.env.ENV = oldENV;
        });
    });
    
}