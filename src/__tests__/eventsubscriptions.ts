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
import axios from 'axios';

import { Wallet } from '../entity/Wallet';
import { Network, Project } from '../entity/Contract';
import { EventSubscription, EventSubscriberAttrs } from '../entity/EventSubscription';
import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AbstractEthereumService } from "../eth/AbstractEthereumService";
import { LoomHooks } from "../eth/LoomHooks";

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


export const EventSubscriptionEntityTests = function() {

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
            await owner.save();
            const other = await Wallet.generate_entity();
            await other.save();

            const local = await utils.setupLocalTestNetContracts({ShipToken: LATEST_SHIPTOKEN, LOAD: LATEST_LOAD}, [owner]);
            const network: Network = await Network.getLocalTestNet();
            const ethereumService: AbstractEthereumService = network.getEthereumService();

            const subscriberAttrs = new EventSubscriberAttrs();
            subscriberAttrs.project = 'ShipToken';
            subscriberAttrs.version = '1.0.0';
            subscriberAttrs.url = ES_NODE;
            subscriberAttrs.receiverType = 'ELASTIC';

            const subscriber = await EventSubscription.getOrCreate(subscriberAttrs);

            const ownerBalance = await local.ShipToken.call_static('balanceOf', [await owner.asyncEvmAddress]);
            expect(ownerBalance[0].toString()).toEqual(ethereumService.unitToWei(500, 'ether').toString());

            if (!LoomHooks.enabled) {
                expect(await ethereumService.getBalance(await owner.asyncEvmAddress)).toEqual(ethereumService.unitToWei(5, 'ether').toString());
            }

            const txParams = await owner.add_tx_params(
                network,
                await local.ShipToken.build_transaction('transfer', [await other.asyncEvmAddress, ethereumService.unitToWei(100, 'ether').toString()]),
            );

            const [signed_tx, txHash] = await owner.sign_tx(txParams);

            const receipt: any = await network.send_tx(signed_tx);

            expect(receipt.transactionHash.length).toEqual(66);

            await AsyncSleep(2000);

            const new_owner_balance = await local.ShipToken.call_static('balanceOf', [await owner.asyncEvmAddress]);
            const new_other_balance = await local.ShipToken.call_static('balanceOf', [await other.asyncEvmAddress]);

            expect(new_owner_balance[0].toString()).toEqual(ethereumService.unitToWei(400, 'ether').toString());

            expect(new_other_balance[0].toString()).toEqual(ethereumService.unitToWei(100, 'ether').toString());

            const status_url = ES_NODE+"/_cat/health";

            //console.log('ElasticSearch Node:', ES_NODE);

            const ES_STATUS = (await axios.get(status_url)).data;

            //console.log('ElasticSearch Status:', ES_STATUS);

            expect(ES_STATUS).toMatch('elasticsearch green');

            //console.log(`Polling contract events ${subscriber.project} -> ${subscriber.url}`);

            await subscriber.pollOnce(local.ShipToken);

            const SLEEP_TIME = 2000; // ElasticSearch is eventually consistent

            //console.log(`Sleeping for ${SLEEP_TIME} milliseconds while ES indexes events...`);

            await AsyncSleep(SLEEP_TIME);

            //console.log(`Getting ES events from ${ES_NODE}`);

            let events_url = ES_NODE+"/events/_search?pretty=true";

            const results = (await axios.get(events_url)).data;

            //console.log('ElasticSearch Events:', results)

            expect(results['hits']['total']['value']).toEqual(4);

        },
        60000, // This one can be a bit slow...
    );
};
