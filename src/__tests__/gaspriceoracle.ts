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

require('./testLoggingConfig');

import 'mocha';
const nock = require('nock');
import { GasPriceOracle } from '../GasPriceOracle';
import { AbstractEthereumService } from "../eth/AbstractEthereumService";
import { LoomHooks } from "../eth/LoomHooks";

export const GasPriceOracleTests = function() {

    it(`has a default price of 20 gwei`, async () => {
        const gpo: GasPriceOracle = GasPriceOracle.Instance;

        // @ts-ignore
        const ethereumService: AbstractEthereumService = gpo.ethereumService;

        expect(gpo.gasPrice).toEqual(ethereumService.unitToWei(20, 'gwei'));
    });

    if (LoomHooks.enabled) {
        console.log('\n\nSKIPPING - GasPriceOracleTests test because Loom does not have gas\n');
    } else {

        it(`can get price from Provider in gwei`, async () => {
            const gpo: GasPriceOracle = GasPriceOracle.Instance;

            // @ts-ignore
            let providerPrice = await gpo.getProviderOracleGasPrice();

            // geth-poa image always generates 18 gwei
            expect(providerPrice).toEqual(18);
        });

        it(`can get price from EthGasStation`, async () => {
            const gpo: GasPriceOracle = GasPriceOracle.Instance;

            nock('https://ethgasstation.info')
                .get('/json/ethgasAPI.json')
                .times(3)
                .reply(200, {
                    fast: 500,
                    fastest: 600,
                    average: 400,
                    safeLow: 300,
                    safeLowWait: 2.0,
                    avgWait: 1.5,
                    fastWait: 1.0,
                    fastestWait: 0.5
                });

            // @ts-ignore
            let ethGasStationPrice = await gpo.getEthGasStationBestPrice();

            // Based on DESIRED_WAIT_TIME of 2 minutes, this should pick safeLow
            expect(ethGasStationPrice.price).toEqual(30);
        });

        it(`can get default price from EthGasStation if no desired time match`, async () => {
            const gpo: GasPriceOracle = GasPriceOracle.Instance;

            nock('https://ethgasstation.info')
                .get('/json/ethgasAPI.json')
                .times(3)
                .reply(200, {
                    fast: 500,
                    fastest: 600,
                    average: 400,
                    safeLow: 300,
                    safeLowWait: 10.0,
                    avgWait: 10.0,
                    fastWait: 10.0,
                    fastestWait: 10.0
                });

            // @ts-ignore
            let ethGasStationPrice = await gpo.getEthGasStationBestPrice();

            // Based on DESIRED_WAIT_TIME of 2 minutes, this should default to fastest
            expect(ethGasStationPrice.price).toEqual(60);
        });

        it(`returns only Provider price when not in PROD`, async () => {
            const gpo: GasPriceOracle = GasPriceOracle.Instance;

            // @ts-ignore
            await gpo.calculateGasPrice();

            // @ts-ignore
            const ethereumService: AbstractEthereumService = gpo.ethereumService;

            expect(gpo.gasPrice).toEqual(ethereumService.unitToWei(18, 'gwei'));
        });
    }

};
