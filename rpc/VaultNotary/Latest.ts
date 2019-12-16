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

// This is the latest supported version of the VaultNotary contract being exposed by the Engine RPC Server
const config = require('config');
const FORCE_KEY = 'FORCE_LATEST_NOTARY_CONTRACT_VERSION';

let _latest = '1.0.0';
if (config.has(FORCE_KEY)) {
    _latest = config.get(FORCE_KEY);
}

export const latest = _latest;
