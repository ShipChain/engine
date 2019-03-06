/*
 * Copyright 2019 ShipChain, Inc.
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

import { EventEmitter } from 'events';
import { Logger } from './Logger';

const logger = Logger.get(module.filename);

export class AsyncPoll extends EventEmitter {
    readonly name: string;
    private readonly interval: number;
    private stopPolling: boolean = false;
    private activeTimeout = null;

    public static SECONDS = 1000;
    public static MINUTES = 60 * AsyncPoll.SECONDS;

    constructor(name: string, callback: any, interval: number = 10 * AsyncPoll.SECONDS, once: boolean = false) {
        super();
        this.name = name;
        this.interval = interval;
        logger.info(`Starting AsyncPoll for ${this.name}`);
        this.on('poll', AsyncPoll.wrapCallback(this, callback, once));
    }

    static wrapCallback(self: AsyncPoll, callback: any, once?: boolean) {
        async function execute() {
            try {
                await callback();
            } catch (err) {
                logger.error(`Error Executing AsyncPoll ${err}`);
            }
            if (!once) {
                self.start();
            }
        }

        return execute;
    }

    start() {
        // Don't set a new interval if poll is stopped
        if (!this.stopPolling) {
            this.activeTimeout = setTimeout(() => {
                // If the interval fires but we've triggered a stop, make sure we don't emit
                if (!this.stopPolling) {
                    logger.silly(`Emitting poll for ${this.name}`);
                    this.emit('poll');
                }
            }, this.interval);
        }
    }

    stop() {
        logger.info(`Stopping AsyncPoll for ${this.name}`);

        this.stopPolling = true;

        // Kill the timeout if it's running
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
        }
    }
}
