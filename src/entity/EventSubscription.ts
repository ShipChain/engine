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

import { BaseEntity, Column, CreateDateColumn, Entity, getConnection, PrimaryColumn } from 'typeorm';
import { Contract } from './Contract';
import { EventEmitter } from 'events';
import { Logger, loggers } from 'winston';
import { getRequestOptions } from '../request-options';

const request = require('request');

// @ts-ignore
const logger: Logger = loggers.get('engine');

const SECONDS = 1000;

export class AsyncPoll extends EventEmitter {
    readonly name: string;
    private readonly interval: number;
    private stopPolling: boolean = false;
    private activeTimeout = null;

    constructor(name: string, callback: any, interval: number = 10 * SECONDS, once: boolean = false) {
        super();
        this.name = name;
        this.interval = interval;
        logger.info(`Starting AsyncPoll for ${this.name}`);
        this.on('poll', AsyncPoll.wrapCallback(this, callback, once));
    }

    static wrapCallback(self: AsyncPoll, callback: any, once?: boolean) {
        async function execute() {
            await callback();
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

class EventSubscriberAttrs {
    url: string;
    project: string;
    eventNames?: string[];
    lastBlock?: number;
    interval?: number;
}

@Entity()
export class EventSubscription extends BaseEntity {
    @PrimaryColumn() url: string;
    @Column() project: string;
    @Column('simple-array') eventNames: string[];
    @Column('bigint') lastBlock: number;
    @Column('int') interval: number;
    @Column('int') errorCount: number;
    @CreateDateColumn() createdDate: Date;

    private contractDriver: any;
    private asyncPolls: AsyncPoll[] = [];

    static SECONDS = 1000;
    static DEFAULT_INTERVAL = 30 * EventSubscription.SECONDS;
    static ERROR_THRESHOLD = 30;

    private static activeSubscriptions: EventSubscription[] = [];

    static async getOrCreate(attrs: EventSubscriberAttrs): Promise<EventSubscription> {
        let eventSubscriber: EventSubscription;

        if (EventSubscription.activeSubscriptions[attrs.url]) {
            logger.debug(`Removing active Subscription to ${attrs.url}`);
            EventSubscription.activeSubscriptions[attrs.url].stop();
            delete EventSubscription.activeSubscriptions[attrs.url];
        }

        try {
            eventSubscriber = await EventSubscription.getByUrl(attrs.url);
            eventSubscriber.eventNames = attrs.eventNames || eventSubscriber.eventNames;
            eventSubscriber.lastBlock = attrs.lastBlock || eventSubscriber.lastBlock;
            eventSubscriber.interval = attrs.interval || eventSubscriber.interval;
            eventSubscriber.errorCount = 0;
            logger.debug(`Updating existing Subscription ${JSON.stringify(eventSubscriber)}`);
        } catch (error) {
            eventSubscriber = new EventSubscription();
            eventSubscriber.url = attrs.url;
            eventSubscriber.project = attrs.project;
            eventSubscriber.eventNames = attrs.eventNames || ['allEvents'];
            eventSubscriber.lastBlock = attrs.lastBlock || 0;
            eventSubscriber.interval = attrs.interval || EventSubscription.DEFAULT_INTERVAL;
            eventSubscriber.errorCount = 0;
            logger.debug(`Creating new Subscription ${JSON.stringify(eventSubscriber)}`);
        }

        EventSubscription.activeSubscriptions[attrs.url] = eventSubscriber;

        return await eventSubscriber.save();
    }

    static async getByUrl(url: string): Promise<EventSubscription> {
        const DB = getConnection();
        const repository = DB.getRepository(EventSubscription);

        let eventSubscriber = await repository.findOne({ url: url });

        if (!eventSubscriber) {
            throw new Error('EventSubscription not found');
        }

        return eventSubscriber;
    }

    static async getStartable(): Promise<EventSubscription[]> {
        const DB = getConnection();
        const repository = DB.getRepository(EventSubscription);

        return await repository.find();
    }

    static async getCount() {
        const DB = getConnection();
        const repository = DB.getRepository(EventSubscription);

        const count = await repository
            .createQueryBuilder('eventSubscription')
            .select('COUNT(eventSubscription.url) AS cnt')
            .getRawMany();

        return count[0]['cnt'];
    }

    static async unsubscribe(url: string) {
        if (EventSubscription.activeSubscriptions[url]) {
            let eventSubscription = EventSubscription.activeSubscriptions[url];
            eventSubscription.stop();
            eventSubscription.remove();
            delete EventSubscription.activeSubscriptions[url];
            return eventSubscription;
        }
        throw new Error('Unable to find Subscription');
    }

    async success(lastBlock: number) {
        logger.debug(`Successfully sent events to ${this.url}`);
        this.errorCount = 0;
        this.lastBlock = lastBlock;
        await this.save();
    }

    async failed() {
        this.errorCount += 1;
        logger.verbose(`Error #${this.errorCount} sending to ${this.url}`);
        await this.save();

        if (this.errorCount >= EventSubscription.ERROR_THRESHOLD) {
            logger.debug(`Stopping subscription for ${this.url}`);
            this.stop();
        }
    }

    async start(contract: Contract) {
        EventSubscription.activeSubscriptions[this.url] = this;

        this.contractDriver = await contract.getDriver();

        for (let eventName of this.eventNames) {
            this.asyncPolls[eventName] = new AsyncPoll(
                this.project + '_' + eventName + '_' + this.url,
                EventSubscription.buildPoll(this, eventName),
                this.interval,
            );
            this.asyncPolls[eventName].start();
        }
    }

    stop() {
        for (let eventName of this.eventNames) {
            if (this.asyncPolls[eventName]) {
                this.asyncPolls[eventName].stop();
                delete this.asyncPolls[eventName];
            }
        }
    }

    static findHighestBlockInEvents(events: any[], previousHighest: number): number {
        let highestBlock = previousHighest;

        for (let event of events) {
            if (event.blockNumber > highestBlock) {
                highestBlock = event.blockNumber;
            }
        }

        return highestBlock;
    }

    private static buildPoll(eventSubscription: EventSubscription, eventName: string) {
        async function pollMethod() {
            return new Promise((resolve, reject) => {
                logger.silly(
                    `Searching for Events fromBlock ${
                        eventSubscription.lastBlock ? +eventSubscription.lastBlock + 1 : 0
                    }`,
                );
                eventSubscription.contractDriver.getPastEvents(
                    eventName,
                    {
                        fromBlock: eventSubscription.lastBlock ? +eventSubscription.lastBlock + 1 : 0,
                        toBlock: 'latest',
                    },
                    async (error, events) => {
                        if (error) {
                            logger.error(`Error retrieving Events: ${error}`);
                            reject(error);
                        }

                        if (events.length) {
                            logger.info(`Found ${events.length} Events`);
                            let highestBlock = EventSubscription.findHighestBlockInEvents(
                                events,
                                eventSubscription.lastBlock,
                            );

                            try {
                                let options = {
                                    url: eventSubscription.url,
                                    json: events,
                                    timeout: 60000,
                                };
                                options = Object.assign(options, await getRequestOptions());

                                request
                                    .post(options)
                                    .on('response', async function(response) {
                                        if (response.statusCode != 200 && response.statusCode != 204) {
                                            logger.error(`Event Subscription Failed with ${response.statusCode} [${eventSubscription.url}]`);
                                            await eventSubscription.failed();
                                            resolve();
                                        } else {
                                            await eventSubscription.success(highestBlock);
                                            resolve();
                                        }
                                    })
                                    .on('error', async function(err) {
                                        logger.error(`Event Subscription Failed with ${err} [${eventSubscription.url}]`);
                                        await eventSubscription.failed();
                                        resolve();
                                    });
                            } catch (_err) {
                                logger.error(`Error posting events to ${eventSubscription.url} ${_err}`);
                                await eventSubscription.failed();
                                resolve();
                            }
                        } else {
                            logger.silly(`Found ${events.length} Events`);
                            resolve();
                        }

                    },
                );
            });
        }

        return pollMethod;
    }
}
