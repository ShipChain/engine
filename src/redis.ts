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

import { Logger } from './Logger';
import { MetricsReporter } from './MetricsReporter';

const redis = require('redis');
const Redlock = require('redlock');
const config = require('config');
const { promisify } = require('util');

const logger = Logger.get(module.filename);
const metrics = MetricsReporter.Instance;

const REDIS_URL = config.get('REDIS_URL');

let redisClient = null;
let redlock = null;

export function getRedisClient() {
    if (!redisClient) {
        redisClient = redis.createClient(REDIS_URL);

        // setup listeners
        redisClient.on('error', error => {
            logger.error(`RedisError: ${error}`);
        });

        // create helper methods for async interactions
        redisClient.asyncHashGet = promisify(redisClient.hget).bind(redisClient);
        redisClient.asyncHashSet = promisify(redisClient.hset).bind(redisClient);
    }
    return redisClient;
}

export async function cacheGet(key: string, field: string): Promise<any> {
    if (!key || !field) {
        throw new Error(`Invalid parameters for cacheGet: (${key},${field})`);
    }

    const client = getRedisClient();

    try {
        return await client.asyncHashGet(key, field);
    } catch (err) {
        metrics.methodFail('redis_cacheGet');
        return null;
    }
}

export async function cacheSet(key: string, field: string, value: any): Promise<void> {
    if (!key || !field || !value) {
        throw new Error(`Invalid parameters for cacheSet: (${key},${field},${value})`);
    }

    const client = getRedisClient();

    try {
        await client.asyncHashSet(key, field, value);
    } catch (err) {
        metrics.methodFail('redis_cacheSet');
    }
}

function getRedlock() {
    if (!redlock) {
        const client = getRedisClient();
        redlock = new Redlock([client], {
            // the expected clock drift; for more details
            // see http://redis.io/topics/distlock
            driftFactor: 0.01, // time in ms

            // the max number of times Redlock will attempt
            // to lock a resource before erroring
            retryCount: 120,

            // the time in ms between attempts
            retryDelay: 500, // time in ms

            // the max time in ms randomly added to retries
            // to improve performance under high contention
            // see https://www.awsarchitectureblog.com/2015/03/backoff.html
            retryJitter: 200, // time in ms
        });
    }
    return redlock;
}

export async function ResourceLock(
    key: string,
    base_obj: any,
    method_to_lock: string,
    params: any = [],
    ttl: number = 5000,
): Promise<any> {
    logger.silly(`Obtaining lock using key ${key} for duration of ${ttl} ms, using method ${method_to_lock}.`);

    return new Promise((resolve, reject) => {
        const lockAttemptTime = Date.now();
        getRedlock()
            .lock(key, ttl)
            .then(async function(lock) {
                const lockObtainTime = Date.now();
                metrics.methodTime('ResourceLock', lockObtainTime - lockAttemptTime);
                logger.silly(`Locked using key ${key} for duration of ${ttl} ms using method ${method_to_lock}.`);

                try {
                    const method_return = await base_obj[method_to_lock](...params);
                    resolve(method_return);
                } catch (err) {
                    reject(err);
                } finally {
                    logger.silly(
                        `Unlocking using key ${key} for duration of ${ttl} ms using method ${method_to_lock}.`,
                    );
                    lock.unlock();
                }
            })
            .catch(function(err) {
                // we weren't able to reach redis; your lock will eventually
                // expire, but you probably want to log this error
                logger.error(`${err}`);
                reject();
            });
    });
}

export const CloseConnection = (callback?) => {
    if (redisClient) {
        redisClient.quit(callback);
    }
    redisClient = null;
    redlock = null;
};
