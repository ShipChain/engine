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

import { ContractCallback } from '../contracts/ContractCallback';
import { getRequestOptions } from '../request-options';
import { Logger, loggers } from 'winston';

const logger: Logger = loggers.get('engine');
const request = require('request');

export class TransmissionConfirmationCallback extends ContractCallback {
    private readonly url: string;

    constructor(callbackUrl?: string) {
        super();
        this.url = callbackUrl;
    }

    async call(method: string, args: any[]) {
        if (this.url) {
            if (!this[method]) {
                logger.error(`Invalid Callback method '${method}'`);
            } else {
                logger.debug(`Transmission Confirmation method '${method}'`);
                this[method](...args);
            }
        }
    }

    private async postData(body: any) {
        try {
            let options = {
                url: this.url,
                json: body,
            }
            options = Object.assign(options, await getRequestOptions());

            request
                .post(options)
                .on('response', function(response) {
                    if (response.statusCode != 204) {
                        logger.error(`Transaction Callback Failed with ${response.statusCode}`);
                    }
                })
                .on('error', function(err) {
                    logger.error(`${err}`);
                });
        } catch (_err) {
            logger.error(`${_err}`);
        }
    }

    protected async confirmation(num, receipt) {
        if (num === ContractCallback.CONFIRMATIONS_REQUIRED) {
            this.postData({
                type: 'ETH_TRANSACTION',
                body: receipt,
            });
        }
    }

    protected async error(error) {
        logger.error(`Error prior to confirmation: ${error}`);
        this.postData({
            type: 'ERROR',
            body: { exception: error.toString() },
        });
    }
}
