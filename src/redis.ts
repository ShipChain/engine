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
import { MetricsReporter } from "./MetricsReporter";

const redis = require('redis');
const Redlock = require('redlock');

// @ts-ignore
const logger: Logger = loggers.get('engine');
const metrics = MetricsReporter.Instance;

const REDIS_URL = process.env.REDIS_URL || 'redis://:redis_pass@redis_db:6379/1';

const redisClient = redis.createClient(REDIS_URL);


const redlock = new Redlock(
    [redisClient],
    {
        // the expected clock drift; for more details
        // see http://redis.io/topics/distlock
        driftFactor: 0.01, // time in ms

        // the max number of times Redlock will attempt
        // to lock a resource before erroring
        retryCount:  120,

        // the time in ms between attempts
        retryDelay:  500, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter:  200 // time in ms
    }
);

export default redlock;

export async function ResourceLock(key: string, base_obj: any, method_to_lock: string, params: any = [], ttl: number = 5000): Promise<any> {
    logger.silly(`Obtaining lock using key ${key} for duration of ${ttl} ms, using method ${method_to_lock}.`);

    return new Promise((resolve, reject) => {
        const lockAttemptTime = Date.now();
        redlock.lock(key, ttl).then(async function(lock) {
            const lockObtainTime = Date.now();
            metrics.methodTime("ResourceLock", lockObtainTime - lockAttemptTime);
            logger.silly(`Locked using key ${key} for duration of ${ttl} ms using method ${method_to_lock}.`);

            const method_return = await (base_obj[method_to_lock])(...params);
            logger.silly(`Unlocking using key ${key} for duration of ${ttl} ms using method ${method_to_lock}.`);

            lock.unlock();

            resolve(method_return);

        }).catch(function(err) {
            // we weren't able to reach redis; your lock will eventually
            // expire, but you probably want to log this error
            console.error(err);
            reject();
        });
    });
}