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

export const uuidv4 = require('uuid/v4');
export const stringify = require('fast-json-stable-stringify');
const crypto = require('crypto');

const DEFAULT_HASH_ALG = 'sha256';


export function stringHash(value: string, alg?: string) {

    if(!alg){
        alg = DEFAULT_HASH_ALG;
    }

    switch(alg){

        case "sha256":
            const hash = crypto.createHash('sha256');
            hash.update(value);
            return "0x" + hash.digest('hex');

        case "keccak256":
            return EthCrypto.hash.keccak256([{value:value, type:'string'}]);

        default:
            throw new Error(`Invalid hashing algorithm ${alg}`);
    }
}

export function objectHash(obj: any, at?: Date, alg?: string) {
    let s_cleaned;

    if(typeof obj === 'string'){
        s_cleaned = obj;
    }

    else {
        /* If the object has a signed property, ignore it */
        let cleaned = { ...obj };
        delete cleaned.signed;
        s_cleaned = stringify(cleaned);
    }

    const s_at = stringify(at);
    return stringHash(s_cleaned + s_at, alg);
}

export function objectSignature(author, obj, at?) {
    at = at || new Date();
    const hash = objectHash(obj, at, (obj.signature && obj.signed.alg ? obj.signed.alg : DEFAULT_HASH_ALG));

    return {
        author: author.public_key,
        hash: hash,
        at: at,
        signature: author.sign_hash(hash),
        alg: (obj.signed && obj.signed.alg ? obj.signed.alg : DEFAULT_HASH_ALG)
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
