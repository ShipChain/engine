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
import { Wallet } from '../entity/Wallet';
import { Network, Project } from '../entity/Contract';
import { EventSubscription, EventSubscriberAttrs } from '../entity/EventSubscription';
import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { EthereumService } from "../eth/EthereumService";

const request = require('request');
const config = require('config');
const utils = require('../local-test-net-utils');

// These are the versions we are testing
const LATEST_SHIPTOKEN = "1.0.0";
const LATEST_LOAD = "1.2.0";

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


export const EventSubscriptionEntityTests = async  function() {

    beforeAll(async () => {
        await EncryptorContainer.init();
    });

    it(
        `can subscribe to ShipToken events`,
        async () => {

            let ES_NODE : string;
            if(config.has("ES_TEST_NODE_URL"))
            {
                ES_NODE = config.get("ES_TEST_NODE_URL");
            }
            else
            {
                console.log('\n\n' +
                    'SKIPPING - ElasticSearch EventSubscription test because ES_TEST_NODE_URL env variable is not set\n' +
                    'USAGE    - Linux users use `ROLE=circleci-es` in bin/docker_tests\n' +
                    'USAGE    - $ sudo sysctl -w vm.max_map_count=262144\n' +
                    'NOTE     - this test FAILS on CircleCI due to vm.max_map_count limits\n');
                return;
            }
            await Project.loadFixturesFromFile('/app/src/__tests__/meta.json');
            const owner = await Wallet.generate_entity();
            const other = await Wallet.generate_entity();

            const local = await utils.setupLocalTestNetContracts({ShipToken: LATEST_SHIPTOKEN, LOAD: LATEST_LOAD}, [owner]);
            const network: Network = await Network.getLocalTestNet();
            const ethereumService: EthereumService = network.getEthereumService();

            const subscriberAttrs = new EventSubscriberAttrs();
            subscriberAttrs.project = 'ShipToken';
            subscriberAttrs.url = ES_NODE;
            subscriberAttrs.receiverType = 'ELASTIC';

            const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

            const SHIP = 10 ** 18;
            const ETH = 10 ** 18;
            const TOTAL = 500 * SHIP;

            expect(Number(await local.ShipToken.call_static('balanceOf', [owner.address]))).toEqual(TOTAL);

            expect(Number(await ethereumService.getBalance(owner.address))).toEqual(5 * ETH);

            const txParams = await owner.add_tx_params(
                network,
                await local.ShipToken.build_transaction('transfer', [other.address, 100 * SHIP]),
            );

            const [signed_tx, txHash] = await owner.sign_tx(txParams);

            const receipt: any = await network.send_tx(signed_tx);

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
};
