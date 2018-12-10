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

require('./testLoggingConfig');

import 'mocha';
import { createConnection } from 'typeorm';
import { Wallet } from '../entity/Wallet';
import { Contract, Version, Project, Network } from '../entity/Contract';
import { EventSubscription, EventSubscriberAttrs } from '../entity/EventSubscription';
import { PrivateKeyDBFieldEncryption } from "../entity/encryption/PrivateKeyDBFieldEncryption";

const request = require('request');
const utils = require('../local-test-net-utils');
const GETH_NODE = process.env.GETH_NODE || 'http://localhost:8545';
const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';

// These are the versions we are testing
const LATEST_SHIPTOKEN = "1.0.0";
const LATEST_LOAD = "1.1.0";

function AsyncSleep(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    })
}

function AsyncGet(url) {
    return new Promise(resolve => {
        request.get(url, (error, response, body) => {
          resolve(body);
        });
    })
}

function AsyncGetJSON(url) {
    return new Promise(resolve => {
        request.get(url, (error, response, body) => {
          let json = JSON.parse(body);
          resolve(json);
        });
    });
}


describe('EventSubscriptionEntity', function() {
    beforeEach(async () => {
        this.connection = await createConnection({
            type: 'sqljs',
            synchronize: true,
            entities: ['src/entity/**/*.ts'],
        });

        Wallet.setPrivateKeyEncryptionHandler(await PrivateKeyDBFieldEncryption.getInstance());
    });

    afterEach(async () => {
        await this.connection.dropDatabase();
        if (this.connection.isConnected) {
            await this.connection.close();
        }
    });

    it(
        `can subscribe to ShipToken events`,
        async () => {
            await Project.loadFixturesFromFile('/meta.json');
            const owner = await Wallet.generate_entity();
            const other = await Wallet.generate_entity();

            const local = await utils.setupLocalTestNetContracts(GETH_NODE, {ShipToken: LATEST_SHIPTOKEN, LOAD: LATEST_LOAD}, [owner]);

            const subscriberAttrs = new EventSubscriberAttrs();
            subscriberAttrs.project = 'ShipToken';
            subscriberAttrs.url = ES_NODE;
            subscriberAttrs.receiverType = 'ELASTIC';

            const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

            const SHIP = 10 ** 18;
            const ETH = 10 ** 18;
            const TOTAL = 500 * SHIP;

            expect(Number(await local.ShipToken.call_static('balanceOf', [owner.address]))).toEqual(TOTAL);

            expect(Number(await local.web3.eth.getBalance(owner.address))).toEqual(5 * ETH);

            const txParams = await owner.add_tx_params(
                local.network,
                await local.ShipToken.build_transaction('transfer', [other.address, 100 * SHIP]),
            );

            const [signed_tx, txHash] = await owner.sign_tx(txParams);

            const receipt = await local.network.send_tx(signed_tx);

            expect(receipt.transactionHash.length).toEqual(66);

            const new_owner_balance = await local.ShipToken.call_static('balanceOf', [owner.address]);
            const new_other_balance = await local.ShipToken.call_static('balanceOf', [other.address]);

            expect(Number(new_owner_balance)).toEqual(TOTAL - 100 * SHIP);

            expect(Number(new_other_balance)).toEqual(100 * SHIP);

            const status_url = ES_NODE+"/_cat/health";

            //console.log('ElasticSearch Node:', ES_NODE);

            const ES_STATUS = await AsyncGet(status_url);

            //console.log('ElasticSearch Status:', ES_STATUS);

            expect(ES_STATUS).toMatch('elasticsearch green');

            //console.log(`Polling contract events ${subscriber.project} -> ${subscriber.url}`);

            await subscriber.pollOnce(local.ShipToken);

            const SLEEP_TIME = 2000; // ElasticSearch is eventually consistent

            //console.log(`Sleeping for ${SLEEP_TIME} milliseconds while ES indexes events...`);

            await AsyncSleep(SLEEP_TIME);

            //console.log(`Getting ES events from ${ES_NODE}`);

            let events_url = ES_NODE+"/events/_search?pretty=true";

            const results = await AsyncGetJSON(events_url);

            //console.log('ElasticSearch Events:', results)

            expect(results['hits']['total']).toEqual(4);

        },
        30000, // This one can be a bit slow...
    );
});