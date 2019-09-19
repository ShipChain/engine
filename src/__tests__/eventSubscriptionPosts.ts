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


require('./testLoggingConfig');

import 'mocha';
const nock = require('nock');
import { EventSubscriberAttrs, EventSubscription } from "../entity/EventSubscription";

export const EventSubscriptionPostsTests = async function() {
    const TEST_URL = 'http://invalid.domain.shipchain.io';
    const TEST_URL_PATH = '/testEvent';
    const EVENTS = [{"blockNumber": 1}, {"blockNumber": 2}];

    it(`Tracks highestChunkBlock with failure before any chunks are done`, async() => {
        const thisNock = nock(TEST_URL)
            .post(TEST_URL_PATH).reply(400, "Error");

        const subscriberAttrs = new EventSubscriberAttrs();
        subscriberAttrs.project = 'LOAD';
        subscriberAttrs.url = TEST_URL + TEST_URL_PATH;
        subscriberAttrs.receiverType = 'POST';
        subscriberAttrs.lastBlock = 0;

        const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

        //@ts-ignore
        await EventSubscription.sendPostEvents(subscriber, EVENTS);

        expect(+subscriber.lastBlock).toEqual(0);

        await EventSubscription.unsubscribe(subscriberAttrs.url, subscriberAttrs.project);

        expect(thisNock.isDone()).toBeTruthy();
    });

    it(`Tracks highestChunkBlock with failure before all chunks are done`, async() => {
        const thisNock = nock(TEST_URL)
            .post(TEST_URL_PATH).reply(204)
            .post(TEST_URL_PATH).reply(400, "Error");

        const subscriberAttrs = new EventSubscriberAttrs();
        subscriberAttrs.project = 'LOAD';
        subscriberAttrs.url = TEST_URL + TEST_URL_PATH;
        subscriberAttrs.receiverType = 'POST';
        subscriberAttrs.lastBlock = 0;

        const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

        //@ts-ignore
        await EventSubscription.sendPostEvents(subscriber, EVENTS);

        expect(+subscriber.lastBlock).toEqual(1);

        await EventSubscription.unsubscribe(subscriberAttrs.url, subscriberAttrs.project);

        expect(thisNock.isDone()).toBeTruthy();
    });

    it(`Tracks highestChunkBlock when all chunks are successful`,  async() => {
        const thisNock = nock(TEST_URL)
            .post(TEST_URL_PATH).reply(204)
            .post(TEST_URL_PATH).reply(204);

        const subscriberAttrs = new EventSubscriberAttrs();
        subscriberAttrs.project = 'LOAD';
        subscriberAttrs.url = TEST_URL + TEST_URL_PATH;
        subscriberAttrs.receiverType = 'POST';
        subscriberAttrs.lastBlock = 0;

        const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

        //@ts-ignore
        await EventSubscription.sendPostEvents(subscriber, EVENTS);

        expect(+subscriber.lastBlock).toEqual(2);

        await EventSubscription.unsubscribe(subscriberAttrs.url, subscriberAttrs.project);

        expect(thisNock.isDone()).toBeTruthy();
    });

};