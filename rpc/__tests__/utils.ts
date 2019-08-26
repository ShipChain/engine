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

import { Method } from 'jayson';

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

export const cleanupDeployedContracts = async (typeorm: any) => {
    try {
        const entities = [
            'Contract', 'Version', 'Network', 'Project',
        ];
        for (const entity of entities) {
            const repository = await typeorm.getConnection().getRepository(entity);
            await repository.remove(await repository.find());
        }
    } catch (error) {
        console.error(`Table Truncation Error ${error}`);
    }
};

export const cleanupEntities = async (typeorm: any) => {
    try {
        const entities = [
            'EventSubscription', 'StorageCredential', 'Wallet',
        ];
        for (const entity of entities) {
            const repository = await typeorm.getConnection().getRepository(entity);
            await repository.remove(await repository.find());
        }
    } catch (error) {
        console.error(`Table Truncation Error ${error}`);
    }
};

// RPCMethod decorator throws this error when required argument not provided
export const expectMissingRequiredParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Missing required parameter${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidUUIDParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid UUID${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidStringParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid String${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidObjectParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid Object${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidDateParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid Date${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidNumberParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid Number${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidParameterCombinationParams = (throwable: Error, options: string[][], provided: string[][]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid Parameter Combination${options.length === 1 ? '' : 's'}`;
    let paramStrings = [];
    for (let [index, option] of options.entries()) {
        if (provided[index].length === 0) {
            paramStrings.push(`One of the following must be provided [${option.join(', ')}]`);
        }
        if (provided[index].length === 2) {
            paramStrings.push(`Only one of the following can be provided [${option.join(', ')}]`);
        }
    }
    expect(throwable.message).toMatch(`${missingPrefix}: '${paramStrings.join(', ')}'`);
};

// RPCMethod decorator throws this error when provided argument does not match expected format
export const expectInvalidStringArrayParams = (throwable: Error, params: string[]) => {
    if(!throwable){
        fail("No Error when one was expected!");
        return;
    }
    const missingPrefix = `Invalid String Array${params.length === 1 ? '' : 's'}`;
    expect(throwable.message).toMatch(`${missingPrefix}: '${params.join(', ')}'`);
};

// RPCMethod decorated methods are called in the RPC Server context which handles
// returning data and/or errors via callbacks.  Since we're calling these directly
// we need a utility method to act as that callback to resolve/reject from the method
const resolveCallback = (resolve: any, reject: any) => {
    return (throwable: Error, data: any) => {
        if(throwable){
            reject(throwable);
        }
        resolve(data);
    };
};

// This makes calling the RPCMethod decorated methods easier as it injects the
// callback handler created above and returns a promise that either returns the
// result of the RPC method or raises an error with the rejection of the promise
export const CallRPCMethod = async (method: any, args: any = null): Promise<any> => {
    return new Promise((resolve, reject) => {
        const jaysonMethod: Method = method;
        jaysonMethod.getHandler().call(null, ...[args, resolveCallback(resolve, reject)]);
    });
};




// Can't have a simple helper/utilities file
// without Jest complaining for empty test file
// This is enough to keep it quiet
// ============================================
it('', () => {});
