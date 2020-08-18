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

import { EventSubscription } from '../src/entity/EventSubscription';
import { MetricsReporter } from '../src/MetricsReporter';

import { RPCMethod, RPCNamespace } from './decorators';
import { LoadedContracts } from './contracts';

const loadedContracts = LoadedContracts.Instance;
const metrics = MetricsReporter.Instance;

@RPCNamespace({ name: 'Event' })
export class RPCEvent {
    @RPCMethod({ require: ['url', 'project', 'version'] })
    public static async Subscribe(args) {
        const project = loadedContracts.get(args.project, args.version);
        const eventSubscription = await EventSubscription.getOrCreate(args);

        await eventSubscription.start(project.getContractEntity());

        // This should be non-blocking
        EventSubscription.getCount()
            .then((count) => {
                metrics.entityTotal('EventSubscription', count);
            })
            .catch((err) => {});

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url,
                version: eventSubscription.version,
            },
        };
    }

    @RPCMethod({ require: ['url', 'project', 'version'] })
    public static async Unsubscribe(args) {
        const eventSubscription = await EventSubscription.unsubscribe(args.url, args.project, args.version);

        return {
            success: true,
            subscription: {
                events: eventSubscription.eventNames,
                contract: eventSubscription.project,
                callback: eventSubscription.url,
                version: eventSubscription.version,
            },
        };
    }
}

export async function startEventSubscriptions() {
    let eventSubscriptions: EventSubscription[] = await EventSubscription.getStartable();

    for (let eventSubscription of eventSubscriptions) {
        await eventSubscription.start(
            loadedContracts.get(eventSubscription.project, eventSubscription.version).getContractEntity(),
        );
    }
}
