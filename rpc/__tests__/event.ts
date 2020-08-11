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


require('../../src/__tests__/testLoggingConfig');

import 'mocha';
import * as typeorm from "typeorm";
import {
    mochaAsync,
    expectMissingRequiredParams,
    cleanupEntities,
    CallRPCMethod,
} from "./utils";

import { RPCEvent } from '../event';
import { EventSubscription } from "../../src/entity/EventSubscription";

export const RPCEventTests = async function() {

    afterAll(async() => {
        await cleanupEntities(typeorm);
    });

    describe('Subscribe', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCEvent.Subscribe,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['url', 'project', 'version']);
        }));

        it(`Throws if Project not found`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCEvent.Subscribe, {
                    url: 'URL',
                    project: 'not a project',
                    version: '1.1.0'
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toContain('Contract \'not a project\' not registered');
            }
        }));

        it(`Returns new subscription`, mochaAsync(async () => {
            expect(await EventSubscription.count()).toEqual(0);
            try {

                const response: any = await CallRPCMethod(RPCEvent.Subscribe,{
                    url: 'URL',
                    project: 'LOAD',
                    version: '1.2.0',
                });

                expect(response).toBeDefined();
                expect(response.success).toBeTruthy();
                expect(response.subscription).toBeDefined();
                expect(response.subscription.contract).toEqual('LOAD');
                expect(response.subscription.callback).toEqual('URL');
                expect(response.subscription.events).toEqual(['allEvents']);
            } catch (err){
                fail(`Should not have thrown [${JSON.stringify(err)}]`);
            }
            expect(await EventSubscription.count()).toEqual(1);
        }));
    });

    describe('Unsubscribe', function() {
        it(`Has required parameters`, mochaAsync(async () => {
            let caughtError;

            try {
                await CallRPCMethod(RPCEvent.Unsubscribe,{});
                fail("Did not Throw"); return;
            } catch (err) {
                caughtError = err;
            }

            expectMissingRequiredParams(caughtError, ['url', 'project', 'version']);
        }));

        it(`Throw if subscription does not exist`, mochaAsync(async () => {
            try {
                await CallRPCMethod(RPCEvent.Unsubscribe,{
                    url: 'URL',
                    project: 'please fail',
                    version: '1.2.0',
                });
                fail('Did not Throw');
            } catch (err){
                expect(err.message).toContain('EventSubscription not found');
            }
        }));

        it(`Successfully unsubscribe`, mochaAsync(async () => {
            expect(await EventSubscription.count()).toEqual(1);
            try {
                const response: any = await CallRPCMethod(RPCEvent.Unsubscribe,{
                    url: 'URL',
                    project: 'LOAD',
                    version: '1.2.0',
                });
                expect(response).toBeDefined();
            } catch (err){
                fail(`Should not have thrown [${err}]`);
            }
            expect(await EventSubscription.count()).toEqual(0);
        }));
    });

};
