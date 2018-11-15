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

import { GenericCallback } from '../entity/Contract';
import { Logger, loggers } from 'winston';

const logger: Logger = loggers.get('engine');

export class ContractCallback extends GenericCallback {
    protected static CONFIRMATIONS_REQUIRED = 12;

    constructor() {
        super();
    }

    async call(method: string, args: any[]) {
        if (!this[method]) {
            logger.error(`Invalid Callback method '${method}'`);
        } else {
            this[method](...args);
        }
    }

    protected async confirmation(num, obj) {
        logger.verbose(`Transaction Confirmation #${num}`);
        if (num === ContractCallback.CONFIRMATIONS_REQUIRED) {
            logger.info(`Transaction confirmed ${obj}`);
        }
    }

    protected async error(error) {
        logger.error(`Transaction error: ${error}`);
    }
}
