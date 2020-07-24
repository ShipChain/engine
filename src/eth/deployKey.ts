/*
 * Copyright 2020 ShipChain, Inc.
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

import { Logger } from '../Logger';
import { getAwsSecret } from '../shipchain/utils';

const logger = Logger.get(module.filename);
const config = require('config');
const ENVIRONMENT = config.util.getEnv('NODE_CONFIG_ENV');
const IS_DEPLOYED_STAGE = config.get('IS_DEPLOYED_STAGE');

export async function getDeployKey() {
    if (IS_DEPLOYED_STAGE) {
        logger.info(`Using deploy_key from aws`);
        let secretKey = await getAwsSecret(`ENGINE_SECRET_KEY_${ENVIRONMENT}`);

        return secretKey.SIDECHAIN_DEPLOYER_KEY;
    } else {
        logger.info(`Using deploy_key from loom config`);
        return config.get('LOOM_CONFIG.DEPLOY_KEY');
    }
}
