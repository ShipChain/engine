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


import { Logger } from "../Logger";
import { EthersEthereumService } from "./ethers/EthersEthereumService";
import { LoomEthersEthereumService } from "./ethers/LoomEthersEthereumService";
import { AbstractEthereumService } from "./AbstractEthereumService";

const config = require("config");

const logger = Logger.get(module.filename);


export class EthereumService {
    private static _esInstance: AbstractEthereumService;

    public static get Instance(): AbstractEthereumService {
        if (!EthereumService._esInstance) {
            if (config.get('IS_LOOM_SIDECHAIN')) {
                logger.info(`Instantiating LoomEthersEthereumService`);
                this._esInstance = new LoomEthersEthereumService();
            } else {
                logger.info(`Instantiating EthersEthereumService`);
                this._esInstance = new EthersEthereumService();
            }
        }
        return this._esInstance;
    }
}
