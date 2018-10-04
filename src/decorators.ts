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

import { Logger, loggers } from 'winston';
import redlock from './redis';

// @ts-ignore
const logger: Logger = loggers.get('engine');

class LockOptions {
    key?: string;
    keyArgument?: number;
    ttl: number = 5000;
}

export function LockMethod(options: LockOptions) {
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

            // metrics.methodCall(target.__rpcNamespace + '.' + propertyKey);
            console.log(`Target: ${target}`)
            const lock_name = getLockName(arguments, options);
            console.log(`lock_name after: ${lock_name}`);

            logger.info(`Obtaining lock using key ${lock_name} for duration of ${options.ttl} ms.`);

            redlock.lock(target.filePath, options.ttl).then(function(lock) {
                originalMethod
                    .apply(context, arguments)
                    .then(resolve => {
                        lock.unlock();
                        logger.info(`Unlocking file with key ${lock_name} for duration of ${options.ttl} ms.`);
                    })
                    .catch(function(err) {
                        lock.unlock();
                        logger.error(`Error file unlocking with key ${lock_name} for duration of ${options.ttl} ms.`);
                    });
            })
        };

        // return edited descriptor as opposed to overwriting the descriptor
        return descriptor;
    };
}

function getLockName(args, options: LockOptions){
    console.log(arguments);
    let lock_name = '';

    console.log(`Arguments: ${options}`);
    if (options && options.key){
        lock_name = options.key;
    } else if ((options && options.keyArgument != undefined) && (options.keyArgument < arguments.length)){
        console.log(`In options.keyArgumenta`);
        lock_name = arguments[options.keyArgument];
    }
    console.log()
    return lock_name;

}
