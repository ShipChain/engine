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

const rpc = require('json-rpc2');
const validator = require('validator');

const logger = Logger.get(module.filename);

// Build Argument Validators
// =========================
let ajv;
let shipmentValidator;

export async function buildSchemaValidators() {
    const fs = require('fs');
    const AJV = require('ajv');
    const fetch = require('node-fetch');

    ajv = new AJV({
        loadSchema: async url => {
            try {
                let response = await fetch(url);
                return await response.json();
            } catch (error) {
                logger.error(`${error}`);
                throw error;
            }
        },
    });

    return new Promise((resolve, reject) => {
        fs.readFile('rpc/primitives/shipment.json', 'utf8', (err, data) => {
            ajv.compileAsync(JSON.parse(data)).then(validate => {
                shipmentValidator = validate;
                resolve();
            });
        });
    });
}

export function uuidArgumentValidator(args, argsToCheck) {
    for (let checkArg in argsToCheck) {
        if (argsToCheck.hasOwnProperty(checkArg)) {
            if (checkArg >= args.length) {
                throw new rpc.Error.InvalidParams('No ' + argsToCheck[checkArg] + ' identifier provided');
            }
            if (typeof args[checkArg] !== 'string' || !validator.isUUID(args[checkArg])) {
                throw new rpc.Error.InvalidParams('Invalid ' + argsToCheck[checkArg] + ' identifier format');
            }
        }
    }
}

export function validateUuid(uuid) {
    return typeof uuid === 'string' && validator.isUUID(uuid);
}

export function validateShipmentArgs(shipment) {
    if (shipmentValidator === null) {
        throw new Error('JSONSchema Validator is invalid');
    }

    let valid = shipmentValidator(shipment);
    if (!valid) {
        throw new rpc.Error.InvalidParams('Shipment Invalid: ' + ajv.errorsText(shipmentValidator.errors));
    }
}
