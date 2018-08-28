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

import { EventSubscription } from "../src/entity/EventSubscription";

import { RPCMethod } from "./decorators";
import { LoadedContracts } from "./loadedContracts";

const loadedContracts = LoadedContracts.Instance;

export class RPCEvent {

    @RPCMethod({require: ["subscription"]})
    public static async Subscribe(args) {

        const eventSubscription = await EventSubscription.getOrCreate(args.subscription);

        await eventSubscription.start(loadedContracts.get(eventSubscription.project).getContractEntity());

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url
            }
        };
    }

    @RPCMethod({require: ["subscription"]})
    public static async Unsubscribe(args) {

        const eventSubscription = await EventSubscription.unsubscribe(args.subscription);

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url
            }
        };
    }
}