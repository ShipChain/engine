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
import { Logger } from '../Logger';
import axios from 'axios';

const logger = Logger.get(module.filename);

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
            let response = await axios.post(this.url, body, await getRequestOptions());
            if (response.status != 204) {
                logger.error(`Transaction Callback Failed with ${response.status}`);
            }
        } catch (_err) {
            logger.error(`${_err}`);
        }
    }

    protected async confirmation(receipt) {
        await this.postData({
            type: 'ETH_TRANSACTION',
            body: receipt,
        });
    }

    protected async error(error) {
        logger.error(`Error prior to confirmation: ${error}`);
        await this.postData({
            type: 'ERROR',
            body: { exception: error.toString() },
        });
    }
}
