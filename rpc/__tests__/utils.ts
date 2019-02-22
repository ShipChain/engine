/*
 * Copyright 2019 ShipChain, Inc.
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

// https://staxmanade.com/2015/11/testing-asyncronous-code-with-mochajs-and-es7-async-await/
// Automatically wrap a test case with try/catch and call the async done() when it's complete
export const mochaAsync = fn => {
    return async done => {
        try {
            await fn();
            done();
        } catch (err) {
            done(err);
        }
    };
};

export const expectMissingRequiredParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Missing required parameter${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

export const expectInvalidUUIDParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid UUID${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

export const resolveCallback = (resolve: any, reject: any) => {
    return (throwable: Error, data: any) => {
        if(throwable){
            reject(throwable);
        }
        resolve(data);
    };
};




// Can't have a simple helper/utilities file
// without Jest complaining for empty test file
// This is enough to keep it quiet
// ============================================
it('', () => {});
