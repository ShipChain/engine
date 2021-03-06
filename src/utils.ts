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
import { Wallet } from './entity/Wallet';
import { v4 } from 'uuid';

export function uuidv4() {
    return v4();
}
export const stringify = require('fast-json-stable-stringify');
const crypto = require('crypto');

const DEFAULT_HASH_ALG = 'sha256';

export function stringHash(value: string, alg?: string) {
    if (!alg) {
        alg = DEFAULT_HASH_ALG;
    }

    switch (alg) {
        case 'sha256':
            const hash = crypto.createHash('sha256');
            hash.update(value);
            return '0x' + hash.digest('hex');

        case 'keccak256':
            return EthCrypto.hash.keccak256([{ value: value, type: 'string' }]);

        default:
            throw new Error(`Invalid hashing algorithm ${alg}`);
    }
}

export function objectHash(obj: any, at?: Date, alg?: string) {
    let s_cleaned;

    if (typeof obj === 'string') {
        s_cleaned = obj;
    } else {
        /* If the object has a signed property, ignore it */
        let cleaned = { ...obj };
        delete cleaned.signed;
        s_cleaned = stringify(cleaned);
    }

    const s_at = stringify(at);
    return stringHash(s_cleaned + s_at, alg);
}

export interface Signature {
    author: string;
    hash: string;
    at: string;
    signature: string;
    alg: string;
}

export function objectSignature(author, obj, at?): Signature {
    at = at || new Date();
    const hash = objectHash(obj, at, obj.signature && obj.signed.alg ? obj.signed.alg : DEFAULT_HASH_ALG);

    return {
        author: author.public_key,
        hash: hash,
        at: at,
        signature: author.sign_hash(hash),
        alg: obj.signed && obj.signed.alg ? obj.signed.alg : DEFAULT_HASH_ALG,
    };
}

export function signObject(author, obj) {
    return Object.assign({}, obj, { signed: objectSignature(author, obj) });
}

export function verifySignature(signed) {
    return signed.author == Wallet.recover_signer_public_key(signed.signature, signed.hash);
}

export function verifyHash(obj) {
    return objectHash(obj, obj.signed.at, obj.signed.alg) == obj.signed.hash;
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function arrayChunker(array, size) {
    const chunked_arr = [];
    for (let index = 0; index < array.length; index += size) {
        chunked_arr.push(array.slice(index, size + index));
    }
    return chunked_arr;
}

/* https://coderwall.com/p/pq0usg/javascript-string-split-that-ll-return-the-remainder
 *
 * A function that splits a string `limit` times and adds the remainder as a final array index.
 *   > var a = 'convoluted.madeup.example';
 *   > a.split('.', 1);
 *   < ['convoluted']
 * What I expected:
 *   < ['convoluted', 'madeup.example']
 *
 */
export function splitRemainder(str, separator, limit) {
    str = str.split(separator);

    if (str.length > limit) {
        let ret = str.splice(0, limit);
        ret.push(str.join(separator));
        return ret;
    }

    return str;
}

// Typescript Mixins
// https://www.typescriptlang.org/docs/handbook/mixins.html
// ========================================================
export function applyMixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            Object.defineProperty(
                derivedCtor.prototype,
                name,
                Object.getOwnPropertyDescriptor(baseCtor.prototype, name),
            );
        });
    });
}
