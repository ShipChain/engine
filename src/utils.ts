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
export const stringify = require('json-stable-stringify');

export function stringHash(value) {
    return EthCrypto.hash.keccak256(value);
}

export function objectHash(obj: any, at?: Date) {
    /* If the object has a signed property, ignore it */
    let cleaned = { ...obj };
    delete cleaned.signed;
    return stringHash(stringify(cleaned) + stringify(at));
}

export function objectSignature(author, obj, at?) {
    at = at || new Date();
    const hash = objectHash(obj, at);

    return {
        author: author.public_key,
        hash: hash,
        at: at,
        signature: author.sign_hash(hash),
    };
}

export function signObject(author, obj) {
    return Object.assign({}, obj, { signed: objectSignature(author, obj) });
}

export function verifySignature(signed) {
    return signed.author == Wallet.recover_signer_public_key(signed.signature, signed.hash);
}

export function verifyHash(obj) {
    return objectHash(obj, obj.signed.at) == obj.signed.hash;
}
