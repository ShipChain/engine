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

import { ShipChainEncryptorContainer } from '../ShipChainEncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from '../../shipchain/AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../../entity/encryption/PrivateKeyDBFieldEncryption'

export const shipChainEncryptorContainerTests = async function() {
    beforeEach(async () => {
        ShipChainEncryptorContainer.clear();
    });

    describe("ShipChainEncryptorContainer", () => {
        it("should throw an error when calling the getter while the defaultEncrptor is null",  () => {
              expect(() => {ShipChainEncryptorContainer.defaultEncryptor}).toThrow(Error);
        });

        it("should have the right type after set, env LOCAL", async () => {
            const oldENV = process.env.ENV;
            process.env.ENV = 'LOCAL';
            await ShipChainEncryptorContainer.init();
            expect(ShipChainEncryptorContainer.defaultEncryptor instanceof PrivateKeyDBFieldEncryption).toBeTruthy();
            process.env.ENV = oldENV;
        });

        it("should still have the type PrivateKeyDBFieldEncryption, because \
        that is what the type of the _instance in PrivateKeyDBFieldEncryption is. env DEV", async () => {
            const oldENV = process.env.ENV;
            process.env.ENV = 'DEV';
            await ShipChainEncryptorContainer.init();
            //console.error('type='+ (ShipChainEncryptorContainer.defaultEncryptor.constructor.name));
            expect(ShipChainEncryptorContainer.defaultEncryptor instanceof PrivateKeyDBFieldEncryption).toBeTruthy();
            //TODO: there may be a way to test this a little bit more with mocking. I
            //think we can mock the encrypt function of both
            //AwsPrivateKeyDBFieldEncryption and PrivateKeyDBFieldEncryption,
            //and making them return different strings. Then we assert the
            //strings here. But the problem is whether it is worthy doing at
            //this moment after all the detailed debugging. 
            //expect(ShipChainEncryptorContainer.PrivateKeyDBFieldEncryptionefaultEncryptor instanceof AwsPrivateKeyDBFieldEncryption).toBeTruthy();
            process.env.ENV = oldENV;
        });
    });
};