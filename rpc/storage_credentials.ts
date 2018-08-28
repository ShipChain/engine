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

import { RPCMethod } from "./decorators";
import { StorageCredential } from "../src/entity/StorageCredential";

export class RPCStorageCredentials {

    @RPCMethod({require: ["credentials"]})
    public static async Create(args) {

        const credentials = StorageCredential.generate_entity(args.credentials);

        await credentials.save();

        return {
            success: true,
            credentials: {
                id: credentials.id,
                title: credentials.title,
                driver_type: credentials.driver_type,
                base_path: credentials.base_path
            }
        };
    }

    @RPCMethod()
    public static async List() {
        const storageCredentials: StorageCredential[] = await StorageCredential.listAll();

        return {
            success: true,
            credentials: storageCredentials
        };
    }
}