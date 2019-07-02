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

import { Logger } from './src/Logger';
import { getAwsSecret } from "./src/shipchain/utils";

const logger = Logger.get(module.filename);
const config = require('config');
const ENVIRONMENT = config.util.getEnv('NODE_CONFIG_ENV')

export async function getRDSconfig() {
    if(!(ENVIRONMENT==='LOCAL' || ENVIRONMENT==='TEST')) {
        let rdsCreds = await getAwsSecret('ENGINE_RDS_'+ENVIRONMENT);

        const rdsUrl = `psql://${rdsCreds.username}:${rdsCreds.password}@${rdsCreds.host}:${rdsCreds.port}/${rdsCreds.dbname}`;

        return {
            type: "postgres",
            url: rdsUrl
        };
    }

    else {
        logger.info(`Skipping AWS RDS Configuration for local or test.`);
        return {};
    }

}
