/*
 * Copyright 2020 ShipChain, Inc.
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
import { cacheGet, cacheSet } from "../redis";

export const RedisTests = async function() {
    const missingKey = 'missing_key';
    const missingField = 'missing_field';

    const key = 'new_key';
    const field = 'new_field';
    const value = 'new_value';
    const value2 = 'new_value2';

    it(`get missing key should be null`, async() => {
        const noValue = await cacheGet(missingKey, missingField);
        expect(noValue).toBeNull();
    });

    it(`get missing field should be null`, async() => {
        try {
            await cacheSet(key, field, value);
        } catch (err) {
            fail(`Should not have thrown [${err}]`);
        }

        const noValue = await cacheGet(key, missingField);
        expect(noValue).toBeNull();
    });

    it(`set new key should succeed`, async() => {
        try {
            await cacheSet(key, field, value);
        } catch (err) {
            fail(`Should not have thrown [${err}]`);
        }

        const returnedValue = await cacheGet(key, field);
        expect(returnedValue).toEqual(value);
    });

    it(`overwrite existing key should succeed`, async() => {
        try {
            await cacheSet(key, field, value);
        } catch (err) {
            fail(`Should not have thrown [${err}]`);
        }

        let returnedValue = await cacheGet(key, field);
        expect(returnedValue).toEqual(value);

        try {
            await cacheSet(key, field, value2);
        } catch (err) {
            fail(`Should not have thrown [${err}]`);
        }

        returnedValue = await cacheGet(key, field);
        expect(returnedValue).toEqual(value2);
    });

};
