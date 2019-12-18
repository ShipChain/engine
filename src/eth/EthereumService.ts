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

// Extension of the MetricsReporter that handles the specific requests for GasPriceOracle
// ======================================================================================
import { LoomEthersEthereumService } from "./ethers/LoomEthersEthereumService";
import { AbstractEthereumService } from "./AbstractEthereumService";

export class EthereumService {
    private static _esInstance: AbstractEthereumService;

    public static get Instance(): AbstractEthereumService {
        if (!EthereumService._esInstance) {
            this._esInstance = new LoomEthersEthereumService();
        }
        return this._esInstance;
    }
}
