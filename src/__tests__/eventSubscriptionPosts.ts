
require('./testLoggingConfig');

import 'mocha';
const nock = require('nock');
import { EventSubscriberAttrs, EventSubscription } from "../entity/EventSubscription";

export const EventSubscriptionPostsTests = async function() {
    let TEST_URL = 'http://TESTING-URL:9999';
    let TEST_URL_PATH = '/testEvent';
    let EVENTS = [{"blockNumber": 1}, {"blockNumber": 2}];

    it(`Test event subscription response`, async () => {
        nock(TEST_URL)
            .post(TEST_URL_PATH)
            .reply(204)
            .post(TEST_URL_PATH)
            .reply(400);

        const subscriberAttrs = new EventSubscriberAttrs();
        subscriberAttrs.project = 'LOAD';
        subscriberAttrs.url = TEST_URL + TEST_URL_PATH;
        subscriberAttrs.receiverType = 'POST';

        const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);
        subscriber.lastBlock = 0;

        // @ts-ignore
        await new Promise (async resolve => { await EventSubscription.sendPostEvents(subscriber, EVENTS, 0, resolve); });

        expect(subscriber.lastBlock).toEqual(1);

    });

};