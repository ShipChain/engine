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

import { BaseEntity, Column, CreateDateColumn, Entity, getConnection, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Contract } from './Contract';
import { getRequestOptions } from '../request-options';
import { Logger } from '../Logger';
import { MetricsReporter } from '../MetricsReporter';
import { AsyncPoll } from '../AsyncPoll';
import { arrayChunker } from '../utils';
import { EthereumService } from '../eth/EthereumService';

const request = require('request');
const requestPromise = require('request-promise-native');
const config = require('config');

const logger = Logger.get(module.filename);
const metrics = MetricsReporter.Instance;

const SECONDS = 1000;

function AsyncPut(url) {
    return new Promise(resolve => {
        request.put(url, (error, response, body) => {
            resolve(body);
        });
    });
}

export class EventSubscriberAttrs {
    url: string;
    project: string;
    receiverType?: string;
    eventNames?: string[];
    lastBlock?: number;
    interval?: number;
}

@Entity()
@Index('URL_PROJECT_INDEX', ['url', 'project'], { unique: true })
export class EventSubscription extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column() url: string;
    @Column() project: string;
    @Column() receiverType: string;
    @Column('simple-array') eventNames: string[];
    @Column('bigint') lastBlock: number;
    @Column('int') interval: number;
    @Column('int') errorCount: number;
    @CreateDateColumn() createdDate: Date;

    private contractInstance: any;
    private contractEntity: Contract;
    private asyncPolls: any = {};

    static DEFAULT_INTERVAL = 30 * SECONDS;
    static ERROR_THRESHOLD = 30;

    private static activeSubscriptions: any = {};

    static async getOrCreate(attrs: EventSubscriberAttrs): Promise<EventSubscription> {
        let eventSubscriber: EventSubscription;

        try {
            eventSubscriber = await EventSubscription.getByUrlAndProject(attrs.url, attrs.project);

            if (EventSubscription.activeSubscriptions[eventSubscriber.id]) {
                logger.debug(`Removing active Subscription to [${eventSubscriber.id}] ${attrs.project}_${attrs.url}`);
                EventSubscription.activeSubscriptions[eventSubscriber.id].stop();
                delete EventSubscription.activeSubscriptions[eventSubscriber.id];
            }

            eventSubscriber.eventNames = attrs.eventNames || eventSubscriber.eventNames;
            eventSubscriber.lastBlock = attrs.lastBlock || eventSubscriber.lastBlock;
            eventSubscriber.interval = attrs.interval || eventSubscriber.interval;
            eventSubscriber.receiverType = attrs.receiverType || eventSubscriber.receiverType;
            eventSubscriber.errorCount = 0;
            logger.debug(`Updating existing Subscription ${JSON.stringify(eventSubscriber)}`);
            await eventSubscriber.save();
        } catch (error) {
            const newSubscriber = new EventSubscription();
            newSubscriber.url = attrs.url;
            newSubscriber.project = attrs.project;
            newSubscriber.eventNames = attrs.eventNames || ['allEvents'];
            newSubscriber.lastBlock = attrs.lastBlock || 0;
            newSubscriber.interval = attrs.interval || EventSubscription.DEFAULT_INTERVAL;
            newSubscriber.receiverType = attrs.receiverType || 'POST';
            newSubscriber.errorCount = 0;
            eventSubscriber = await newSubscriber.save();
            logger.debug(`Creating new Subscription ${JSON.stringify(eventSubscriber)}`);
        }

        EventSubscription.activeSubscriptions[eventSubscriber.id] = eventSubscriber;

        return eventSubscriber;
    }

    static async getByUrlAndProject(url: string, project: string): Promise<EventSubscription> {
        const DB = getConnection();
        const repository = DB.getRepository(EventSubscription);

        let eventSubscriber = await repository.findOne({ url: url, project: project });

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
            .createQueryBuilder()
            .from('EventSubscription', 'es')
            .select('COUNT(*) AS cnt')
            .groupBy('es.url, es.project')
            .getRawMany();

        return count[0]['cnt'];
    }

    static async unsubscribe(url: string, project: string) {
        let subscriptionObject = await EventSubscription.getByUrlAndProject(url, project);

        if (EventSubscription.activeSubscriptions[subscriptionObject.id]) {
            const activeSubscription = EventSubscription.activeSubscriptions[subscriptionObject.id];
            activeSubscription.stop();
            await activeSubscription.remove();
            delete EventSubscription.activeSubscriptions[subscriptionObject.id];
            return subscriptionObject;
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

    async pollOnce(contract: Contract) {
        EventSubscription.activeSubscriptions[this.id] = this;

        this.contractEntity = contract;
        this.contractInstance = await contract.getContractInstance();

        for (let eventName of this.eventNames) {
            let pollMethod = EventSubscription.buildPoll(this, eventName);
            await pollMethod();
        }
    }

    async start(contract: Contract) {
        EventSubscription.activeSubscriptions[this.id] = this;

        this.contractEntity = contract;
        this.contractInstance = await contract.getContractInstance();

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

    private static async sendPostEvents(eventSubscription: EventSubscription, allEvents) {
        try {
            let EVENT_CHUNK_SIZE = config.get('EVENT_CHUNK_SIZE');
            let chunkedEvents = arrayChunker(allEvents, EVENT_CHUNK_SIZE);

            for (let chunkIndex = 0; chunkIndex < chunkedEvents.length; chunkIndex++) {
                let highestChunkBlock = EventSubscription.findHighestBlockInEvents(
                    chunkedEvents[chunkIndex],
                    eventSubscription.lastBlock,
                );

                try {
                    await EventSubscription.sendPostEventsChunk(
                        eventSubscription,
                        chunkedEvents[chunkIndex],
                        highestChunkBlock,
                    );
                } catch (err) {
                    break;
                }
            }
        } catch (_err) {
            await eventSubscription.failed();
        }
    }

    private static async sendPostEventsChunk(eventSubscription: EventSubscription, chunk, highestChunkBlock) {
        let options = {
            url: eventSubscription.url,
            json: {
                events: chunk,
                project: eventSubscription.project,
            },
            timeout: 90 * SECONDS,
        };

        options = Object.assign(options, await getRequestOptions());

        try {
            await requestPromise.post(options);
            await eventSubscription.success(highestChunkBlock);
        } catch (err) {
            await eventSubscription.failed();
            throw err;
        }
    }

    private static async sendElasticEvents(eventSubscription: EventSubscription, events, highestBlock) {
        try {
            logger.info(`About to put events to ElasticSearch ${eventSubscription.project}_${eventSubscription.url}`);

            await AsyncPut(eventSubscription.url + '/events/');

            for (let event of events) {
                await EventSubscription.sendElasticEventSingle(eventSubscription, event, highestBlock);
            }
        } catch (_err) {
            logger.error(
                `Error putting events to ElasticSearch ${eventSubscription.project}_${eventSubscription.url} ${_err}`,
            );
            await eventSubscription.failed();
        }
    }

    private static async sendElasticEventSingle(eventSubscription, event, highestBlock) {
        let options = {
            url: eventSubscription.url + '/events/_doc',
            json: {
                network_id: eventSubscription.contractEntity.network.id,
                network_title: eventSubscription.contractEntity.network.title,
                project_id: eventSubscription.contractEntity.project.id,
                project_title: eventSubscription.contractEntity.project.title,
                version_id: eventSubscription.contractEntity.version.id,
                version_title: eventSubscription.contractEntity.version.title,
                ...event,
            },
            timeout: 1 * SECONDS,
        };
        return new Promise(async (resolve, reject) => {
            request
                .post(options)
                .on('response', async function(response) {
                    if (response.statusCode != 201 && response.statusCode != 204) {
                        logger.error(
                            `Event Subscription Failed with ${response.statusCode} [${eventSubscription.project}_${eventSubscription.url}]`,
                        );
                        await eventSubscription.failed();
                        resolve();
                    } else {
                        await eventSubscription.success(highestBlock);
                        resolve();
                    }
                })
                .on('error', async function(err) {
                    logger.error(
                        `Event Subscription Failed with ${err} [${eventSubscription.project}_${eventSubscription.url}]`,
                    );
                    await eventSubscription.failed();
                    resolve();
                });
        });
    }

    private static buildPoll(eventSubscription: EventSubscription, eventName: string) {
        async function pollMethod() {
            const fromBlock: number = eventSubscription.lastBlock ? +eventSubscription.lastBlock + 1 : 0;

            const startTime = Date.now();
            const ethereumService: EthereumService = await eventSubscription.contractEntity.network.getEthereumService();

            try {
                const logs = await ethereumService.getContractEvents(
                    eventSubscription.contractInstance,
                    fromBlock,
                    eventName,
                );

                if (logs.length) {
                    metrics.methodTime('getPastEvents', Date.now() - startTime, {
                        eventName: eventName,
                        web3: true,
                    });

                    logger.info(`Found ${logs.length} '${eventName}' Events`);

                    let highestBlock = EventSubscription.findHighestBlockInEvents(logs, fromBlock);

                    switch (eventSubscription.receiverType) {
                        case 'POST':
                            await EventSubscription.sendPostEvents(eventSubscription, logs);
                            break;
                        case 'ELASTIC':
                            await EventSubscription.sendElasticEvents(eventSubscription, logs, highestBlock);
                            break;
                        default:
                            throw new Error(`Unknown ReceiverType: ${eventSubscription.receiverType}`);
                    }
                } else {
                    logger.silly(`Found 0 Events`);
                }
            } catch (err) {
                logger.error(`Error retrieving Events: ${err}`);
            }
        }

        return pollMethod;
    }
}
