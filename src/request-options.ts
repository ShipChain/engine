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

const fs = require('fs'),
    certFile = '/app/client-cert.crt',
    keyFile = '/app/client-cert.key',
    caFile = '/app/ca-bundle.crt';

import { Logger } from './Logger';
const config = require('config');
const logger = Logger.get(module.filename);

let options = null;

export async function getRequestOptions() {
    if (config.get('IS_DEPLOYED_STAGE')) {
        if (!options) {
            options = {
                cert: fs.readFileSync(certFile),
                key: fs.readFileSync(keyFile),
                ca: fs.readFileSync(caFile),
            };
        }
        return options;
    } else {
        logger.info(`Skipping certificate loading for local stages`);
        return {};
    }
}
