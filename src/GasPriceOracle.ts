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

const regression = require('regression');

import { AsyncPoll } from './AsyncPoll';
import { Logger } from './Logger';
import { MetricsReporter } from './MetricsReporter';
import { delay } from './utils';
import { AbstractEthereumService } from './eth/AbstractEthereumService';
import { EthereumService } from './eth/EthereumService';
import { LoomHooks } from './eth/LoomHooks';

const requestPromise = require('request-promise-native');
const config = require('config');

const logger = Logger.get(module.filename);

// Time (in minutes) that we don't want to wait longer than
const DESIRED_WAIT_TIME: number = 2;

// How often the gas price oracle re-calculates
const CALCULATION_INTERVAL: number = Number(config.get('GPO_INTERVAL')) || 1.5 * AsyncPoll.MINUTES;

// Gas Price Oracle service to handle background updates of the most
// recent gas price estimates.  This will run every CALCULATION_INTERVAL
// and average data from EthGasStation and eth_gasPrice() and aim for a
// wait time roughly around DESIRED_WAIT_TIME.  This should be a decent
// compromise between wait time and gas prices that are paid.
// =====================================================================
export class GasPriceOracle {
    private static _instance: GasPriceOracle;
    private static asyncPoll: AsyncPoll;

    private _gasPrice;
    private readonly ethereumService: AbstractEthereumService;
    private readonly gasPriceMetrics: GasPriceOracleMetrics;

    private constructor() {
        this.ethereumService = EthereumService.Instance;

        // Default gas price in case no services are returning values (likely will never be used)
        this._gasPrice = this.ethereumService.unitToWei('20', 'gwei');
        this.gasPriceMetrics = GasPriceOracleMetrics.Instance;
    }

    public static get Instance(): GasPriceOracle {
        return this._instance || (this._instance = new this());
    }

    // Property for retrieving last calculated gasPrice
    // ------------------------------------------------
    public get gasPrice() {
        return this._gasPrice;
    }

    // Method to start the AsyncPoll.  This should be called once from the application startup
    // ---------------------------------------------------------------------------------------
    public static async Start(): Promise<void> {
        if (LoomHooks.enabled) {
            logger.info(`Detected Loom configuration. Halting GasPriceOracle`);
            return;
        }

        const instance = GasPriceOracle.Instance;

        if (!this.asyncPoll) {
            // Set the initial price
            await instance.calculateGasPrice();

            // Build polling instance
            this.asyncPoll = new AsyncPoll('GasPriceOracle', GasPriceOracle.buildPoll(instance), CALCULATION_INTERVAL);

            // Start the poll for ongoing calculations
            this.asyncPoll.start();
        } else {
            logger.warn(`GasPriceOracle already started!`);
        }
    }

    // The AsyncPoll needs a method with appropriate instance context.  This method returns an async method
    // calling the calculateGasPrice method on the GasPriceOracle _instance that is passed in.
    // ----------------------------------------------------------------------------------------------------
    private static buildPoll(gpo: GasPriceOracle) {
        return async () => {
            try {
                await gpo.calculateGasPrice();
            } catch (err) {
                logger.error(`GasPriceOracle failed to get new price. Using previous value ${gpo.gasPrice}. [${err}]`);
            }
        };
    }

    // Average the EthGasStation and ProviderOracleGasPrice values
    // -------------------------------------------------------
    private async calculateGasPrice(): Promise<void> {
        // allPrices in Gwei for consistent calculations
        const allPrices = [];
        let ethGasStationCalculation: EthGasStationCalculation;

        // Only include EthGasStation request if we're running against Mainnet
        if (config.get('GPO_ETH_GAS_STATION')) {
            ethGasStationCalculation = await this.getEthGasStationBestPrice();

            // Weight towards the EthGasStation price since it's based on a wait time instead of just a median value
            allPrices.push(ethGasStationCalculation.price);
            allPrices.push(ethGasStationCalculation.price);
        }

        // Always use the attached node's gas price oracle
        allPrices.push(await this.getProviderOracleGasPrice());

        let priceAverage = allPrices.reduce((total, currentValue, currentIndex) => {
            return total + (currentValue - total) / (currentIndex + 1);
        }, 0);

        priceAverage = Number(priceAverage.toFixed(2));

        // Prevent too rapid growth of gas price used
        let previousGasPrice = Number(this.ethereumService.weiToUnit(this._gasPrice, 'gwei'));
        priceAverage = Math.min(priceAverage, 4 * previousGasPrice);

        this.gasPriceMetrics.gasPriceSingle('calculated', priceAverage);

        // Predict the wait time if we have Eth Gas Station data (with prediction method)
        if (ethGasStationCalculation) {
            const prediction = ethGasStationCalculation.predict(priceAverage);
            logger.debug(`Predicted Wait Time  : ${prediction[1]}m`);
            this.gasPriceMetrics.waitTimeSingle('calculated', prediction[1]);
        }

        // parseUnits prefers a string representation of the input number
        this._gasPrice = this.ethereumService.unitToWei(`${priceAverage}`, 'gwei');
    }

    // Pull data from the EthGasStation and find the gas price that gives us the desired wait time
    // -------------------------------------------------------------------------------------------
    private async getEthGasStationBestPrice(): Promise<EthGasStationCalculation> {
        let data = await GasPriceOracle.getEthGasStationJson();

        // EthGasStation API does not report data in gwei.  I think this is 100s of babbages...
        data.fastest /= 10.0;
        data.fast /= 10.0;
        data.average /= 10.0;
        data.safeLow /= 10.0;

        let desiredPrice: number = -1;

        // Select the desired gas price based on the wait times reported
        if (data.fastestWait <= DESIRED_WAIT_TIME) {
            desiredPrice = data.fastest;
        }
        if (data.fastWait <= DESIRED_WAIT_TIME) {
            desiredPrice = data.fast;
        }
        if (data.avgWait <= DESIRED_WAIT_TIME) {
            desiredPrice = data.average;
        }
        if (data.safeLowWait <= DESIRED_WAIT_TIME) {
            desiredPrice = data.safeLow;
        }

        // If none of the wait times meet our desired time, then default for the fastest to get the transaction in soon
        if (desiredPrice === -1) {
            logger.warn(`No gas price from EthGasStation provides a sufficient time`);
            desiredPrice = data.fastest;
        }

        GasPriceOracle.logEthGasStationPrices(data, desiredPrice);
        this.gasPriceMetrics.ethGasStation(data);

        // Calculate Regression on Gwei/WaitTime for predicting wait times for final gwei
        let waitPoints = [
            [+data.fastest, +data.fastestWait],
            [+data.fast, +data.fastWait],
            [+data.average, +data.avgWait],
            [+data.safeLow, +data.safeLowWait],
        ];

        // Power regression matches the best with all the test data seen
        // Alternatively exponential is close as well
        const regressionOutput = regression.power(waitPoints);

        return {
            price: Number(desiredPrice),
            predict: regressionOutput.predict,
        };
    }

    // EthGasStation API can return high outlier data.
    // We are selecting the best data for our calculations
    // ---------------------------------------------------
    private static async getEthGasStationJson() {
        const url = `https://ethgasstation.info/json/ethgasAPI.json`;

        let returnEgs: EthGasStationInfo;

        let egs1: EthGasStationInfo = await GasPriceOracle.retrieveJson(url);

        await delay(0.5 * AsyncPoll.SECONDS);
        let egs2: EthGasStationInfo = await GasPriceOracle.retrieveJson(url);

        await delay(0.5 * AsyncPoll.SECONDS);
        let egs3: EthGasStationInfo = await GasPriceOracle.retrieveJson(url);

        returnEgs = egs1;

        if (egs2.safeLowWait < returnEgs.safeLowWait) {
            returnEgs = egs2;
        }

        if (egs3.safeLowWait < returnEgs.safeLowWait) {
            returnEgs = egs3;
        }

        return returnEgs;
    }

    // Get the 60% Median gas price of the last 20 blocks by the eth_gasPrice call
    // ---------------------------------------------------------------------------
    private async getProviderOracleGasPrice(): Promise<number> {
        const providerOracleGasPrice = Number(
            this.ethereumService.weiToUnit(await this.ethereumService.getGasPrice(), 'gwei'),
        );
        logger.debug(`Provider Gas Price Oracle: ${providerOracleGasPrice} gwei`);
        this.gasPriceMetrics.gasPriceSingle('web3', providerOracleGasPrice);
        return providerOracleGasPrice;
    }

    // Generic Retrieve JSON from api
    // ------------------------------
    private static async retrieveJson(apiUrl: string): Promise<any> {
        const requestOptions = {
            uri: apiUrl,
            json: true,
            timeout: 5000,
        };

        try {
            return await requestPromise(requestOptions);
        } catch (err) {
            logger.error(`Retrieving JSON from ${apiUrl} failed with ${err}`);
            throw err;
        }
    }

    // Log the GasStation Gwei -> Wait Time values
    // -------------------------------------------
    private static logEthGasStationPrices(data: EthGasStationInfo, desiredPrice: number) {
        logger.debug(
            `GasStation Fastest   : ${data.fastest} gwei  [${data.fastestWait}m] ` +
                `${desiredPrice <= data.fastest ? '+' : ''}`,
        );
        logger.debug(
            `GasStation Fast      : ${data.fast} gwei  [${data.fastWait}m] ` +
                `${desiredPrice <= data.fast ? '+' : ''}`,
        );
        logger.debug(
            `GasStation Average   : ${data.average} gwei  [${data.avgWait}m] ` +
                `${desiredPrice <= data.average ? '+' : ''}`,
        );
        logger.debug(
            `GasStation SafeLow   : ${data.safeLow} gwei  [${data.safeLowWait}m] ` +
                `${desiredPrice <= data.safeLow ? '+' : ''}`,
        );
    }
}

// The schema from EthGasStation's API
// ===================================
interface EthGasStationInfo {
    fast: number;
    fastest: number;
    safeLow: number;
    average: number;
    block_time: number;
    blockNum: number;
    speed: number;
    safeLowWait: number;
    avgWait: number;
    fastWait: number;
    fastestWait: number;
}

// The schema for getEthGasStationBestPrice's return
// =================================================
interface EthGasStationCalculation {
    price: number;
    predict: Function;
}

// Extension of the MetricsReporter that handles the specific requests for GasPriceOracle
// ======================================================================================
class GasPriceOracleMetrics extends MetricsReporter {
    private static influxPriceMeasurementName: string = 'engine.gas_price';
    private static influxWaitMeasurementName: string = 'engine.txn_wait_estimate';
    private static _gpoInstance: GasPriceOracleMetrics;

    protected constructor() {
        super();
    }

    public static get Instance(): GasPriceOracleMetrics {
        return this._gpoInstance || (this._gpoInstance = new this());
    }

    // Report a single gas price from `source`
    // ---------------------------------------
    public gasPriceSingle(source: string, price: number, tags: any = {}) {
        const point = MetricsReporter.buildPoint(Object.assign({ source: source }, tags), { price: price });
        this.report(GasPriceOracleMetrics.influxPriceMeasurementName, point);
    }

    // Report a single wait time from `source`
    // ---------------------------------------
    public waitTimeSingle(source: string, wait: number, tags: any = {}) {
        const point = MetricsReporter.buildPoint(Object.assign({ source: source }, tags), { wait: wait });
        this.report(GasPriceOracleMetrics.influxWaitMeasurementName, point);
    }

    // Report the price and estimated wait times for all the EthGasStation data points returned
    // ----------------------------------------------------------------------------------------
    public ethGasStation(info: EthGasStationInfo, tags: any = {}) {
        this.ethGasStationPrice(info, tags);
        this.ethGasStationWait(info, tags);
    }

    public ethGasStationPrice(info: EthGasStationInfo, tags: any = {}) {
        const source = 'gas_station';

        const fastestPoint = MetricsReporter.buildPoint(Object.assign({ source: source, speed: 'fastest' }, tags), {
            price: info.fastest,
        });
        const fastPoint = MetricsReporter.buildPoint(Object.assign({ source: source, speed: 'fast' }, tags), {
            price: info.fast,
        });
        const averagePoint = MetricsReporter.buildPoint(Object.assign({ source: source, speed: 'average' }, tags), {
            price: info.average,
        });
        const safeLowPoint = MetricsReporter.buildPoint(Object.assign({ source: source, speed: 'safeLow' }, tags), {
            price: info.safeLow,
        });

        this.reportMultiple(GasPriceOracleMetrics.influxPriceMeasurementName, [
            fastestPoint,
            fastPoint,
            averagePoint,
            safeLowPoint,
        ]);
    }

    public ethGasStationWait(info: EthGasStationInfo, tags: any = {}) {
        const source = 'gas_station';

        const fastestPoint = MetricsReporter.buildPoint(Object.assign({ source: source, wait: 'fastest' }, tags), {
            wait: info.fastestWait,
        });
        const fastPoint = MetricsReporter.buildPoint(Object.assign({ source: source, wait: 'fast' }, tags), {
            wait: info.fastWait,
        });
        const averagePoint = MetricsReporter.buildPoint(Object.assign({ source: source, wait: 'average' }, tags), {
            wait: info.avgWait,
        });
        const safeLowPoint = MetricsReporter.buildPoint(Object.assign({ source: source, wait: 'safeLow' }, tags), {
            wait: info.safeLowWait,
        });

        this.reportMultiple(GasPriceOracleMetrics.influxWaitMeasurementName, [
            fastestPoint,
            fastPoint,
            averagePoint,
            safeLowPoint,
        ]);
    }
}
