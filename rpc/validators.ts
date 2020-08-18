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

import { Logger } from '../src/Logger';
import axios from 'axios';
const config = require('config');

const logger = Logger.get(module.filename);

const UUIDv = {
    3: /^[0-9A-F]{8}-[0-9A-F]{4}-3[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
    4: /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    5: /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    all: /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
};

// Build Argument Validators
// =========================
let ajv;

const BASE_URL = config.get('SCHEMA_BASE_URL');
const VERSION = config.get('SCHEMA_VERSION');

const schemaFiles = ['shipment.json', 'tracking.json'];

function _buildUrl(file) {
    return `${BASE_URL}/${VERSION}/${file}`;
}

async function loadSchemaFromUrl(url) {
    try {
        logger.debug(`Loading Schema from: ${url}`);
        return (await axios.get(url)).data;
    } catch (error) {
        logger.error(`${error}`);
        throw error;
    }
}

export async function buildSchemaValidators() {
    const AJV = require('ajv');
    ajv = new AJV({ loadSchema: loadSchemaFromUrl });

    await Promise.all(
        schemaFiles.map(async (file) => {
            let data = await loadSchemaFromUrl(_buildUrl(file));
            await ajv.compileAsync(data);
        }),
    );
}

export function validateUuid(uuid, version = 4): boolean {
    if (typeof uuid !== 'string') {
        return false;
    }
    const pattern = UUIDv[version];
    return pattern && pattern.test(uuid);
}

export function validateShipmentArgs(shipment) {
    let valid = ajv.validate(_buildUrl('shipment.json'), shipment);
    if (!valid) {
        throw new Error('Shipment Invalid: ' + ajv.errorsText());
    }
}
