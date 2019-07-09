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

// Import Moment Typings and Functions
import { Moment } from 'moment';
import moment from 'moment';
const MOMENT_FORMAT: string = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

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
    string?: string[];
    object?: string[];
    date?: string[];
    number?: string[];
    requireOne?: RPCMethodValidateRequireOneOptions[];
}

class RPCMethodValidateRequireOneOptions {
    arg1: string;
    arg2: string;
}

class RPCMethodValidateRequireOne {
    arg1: string;
    arg2: string;

    private readonly __found__: number = 0;

    constructor(arg1: string, arg2: string, providedArgs: any) {
        this.arg1 = arg1;
        this.arg2 = arg2;

        if (providedArgs && providedArgs.hasOwnProperty(this.arg1)) {
            this.__found__ += 1;
        }
        if (providedArgs && providedArgs.hasOwnProperty(this.arg2)) {
            this.__found__ += 1;
        }
    }

    public static fromOptions(options: RPCMethodValidateRequireOneOptions, args: any) {
        return new RPCMethodValidateRequireOne(options.arg1, options.arg2, args);
    }

    public isValid() {
        return this.__found__ === 1;
    }

    public toString(): string {
        let errorString = `One of the following must be provided [${this.arg1}, ${this.arg2}]`;
        if (this.__found__ >= 1) {
            errorString = `Only one of the following can be provided [${this.arg1}, ${this.arg2}]`;
        }
        return errorString;
    }
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

            logger.debug(`Invoking RPCMethod: '${propertyKey}' in '${target.name || target.constructor.name}'`);
            originalMethod
                .apply(context, arguments)
                .then(resolve => callback(null, resolve))
                .catch(reject => {
                    metrics.methodFail(target.__rpcNamespace + '.' + propertyKey);
                    callback(reject);
                });
        };

        // Add the RPCMethod options that are validated as a property on the method
        Object.defineProperty(descriptor.value, 'rpcOptions', {
            value: options,
            writable: false,
            enumerable: true,
            configurable: false,
        });

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
    // Check UUID format
    // -----------------
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

    // Check String format
    // -------------------
    if (validations && validations.string) {
        for (let param of validations.string) {
            if (args && args.hasOwnProperty(param) && !(typeof args[param] === 'string')) {
                failed.push(param);
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(`Invalid String${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`);
    }

    // Check Object format
    // -------------------
    if (validations && validations.object) {
        for (let param of validations.object) {
            if (args && args.hasOwnProperty(param)) {
                if (typeof args[param] !== 'object' || Array.isArray(args[param])) {
                    failed.push(param);
                } else {
                    try {
                        JSON.stringify(args[param]);
                    } catch (err) {
                        failed.push(param);
                    }
                }
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(`Invalid Object${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`);
    }

    // Check Date format
    // -----------------
    if (validations && validations.date) {
        for (let param of validations.date) {
            if (args && args.hasOwnProperty(param)) {
                if (typeof args[param] === 'string') {
                    const dateCheck: Moment = moment(args[param], MOMENT_FORMAT, true);
                    if (!dateCheck.isValid()) {
                        failed.push(param);
                    }
                } else {
                    failed.push(param);
                }
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(`Invalid Date${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`);
    }

    // Check Number format
    // -------------------
    if (validations && validations.number) {
        for (let param of validations.number) {
            if (args && args.hasOwnProperty(param)) {
                if (typeof args[param] !== 'number' || isNaN(args[param])) {
                    failed.push(param);
                }
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(`Invalid Number${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`);
    }

    // Check Number format
    // -------------------
    if (validations && validations.requireOne) {
        for (let requireOneOptions of validations.requireOne) {
            let requireOne: RPCMethodValidateRequireOne = RPCMethodValidateRequireOne.fromOptions(
                requireOneOptions,
                args,
            );
            if (!requireOne.isValid()) {
                failed.push(`${requireOne}`);
            }
        }
    }

    if (failed.length > 0) {
        throw new rpc.Error.InvalidParams(
            `Invalid Parameter Combination${failed.length === 1 ? '' : 's'}: '${failed.join(', ')}'`,
        );
    }
}
