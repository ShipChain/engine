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

import { validateUuid } from './validators';
import { MetricsReporter } from '../src/MetricsReporter';
import { Logger } from '../src/Logger';

const rpc = require('json-rpc2');

const logger = Logger.get(module.filename);
const metrics = MetricsReporter.Instance;

class RPCNamespaceOptions {
    name: string;
}

export function RPCNamespace(options: RPCNamespaceOptions) {
    return function RPCNamespace(target: any) {
        let original = target;

        original.__isRpcClass = true;
        original.__rpcNamespace = options.name;

        return original;
    };
}

class RPCMethodOptions {
    require?: string[];
    validate?: RPCMethodValidateOptions;
}

class RPCMethodValidateOptions {
    uuid?: string[];
}

export function RPCMethod(options?: RPCMethodOptions) {
    return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
        // save a reference to the original method this way we keep the values currently in the
        // descriptor and don't overwrite what another decorator might have done to the descriptor.
        if (descriptor === undefined) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
        }
        const originalMethod = descriptor.value;

        //editing the descriptor/value parameter
        descriptor.value = function() {
            let context = this;

            // We cannot check this at compile time due to the class-decorator not being
            // fully applied yet while the methods are being defined within the class
            if (!target.__isRpcClass) {
                logger.error(
                    `@RPCMethod '${propertyKey}' used outside of @RPCNamespace in '${target.name ||
                        target.constructor.name}'`,
                );
            }

            metrics.methodCall(target.__rpcNamespace + '.' + propertyKey);

            checkOptions(arguments, options);

            const callback = arguments[2];

            logger.debug(`Invoking RPCMethod: '${propertyKey}' in '${target.name ||
                        target.constructor.name}'`);
            originalMethod
                .apply(context, arguments)
                .then(resolve => callback(null, resolve))
                .catch(reject => {
                    metrics.methodFail(target.__rpcNamespace + '.' + propertyKey);
                    callback(reject);
                });
        };

        // return edited descriptor as opposed to overwriting the descriptor
        return descriptor;
    };
}

function checkOptions(args, options: RPCMethodOptions) {
    if (options && options.require) {
        checkRequiredParameters(args[0], options.require);
    }

    if (options && options.validate) {
        validateParameters(args[0], options.validate);
    }
}

function checkRequiredParameters(args, required: string[]) {
    let missing: string[] = [];

    for (let param of required) {
        if (!args || !args.hasOwnProperty(param)) {
            missing.push(param);
        }
    }

    if (missing.length > 0) {
        throw new rpc.Error.InvalidParams(
            `Missing required parameter${missing.length === 1 ? '' : 's'}: '${missing.join(', ')}'`,
        );
    }
}

function validateParameters(args, validations: RPCMethodValidateOptions) {
    let failed: string[] = [];

    if (validations && validations.uuid) {
        for (let param of validations.uuid) {
            if (args && args.hasOwnProperty(param) && !validateUuid(args[param])) {
                failed.push(param);
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(`Invalid UUID${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`);
    }
}
