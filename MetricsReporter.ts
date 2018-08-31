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

import { InfluxDB, IPoint, IWriteOptions } from "influx";
import { Logger, loggers } from "winston";

// @ts-ignore
const logger: Logger = loggers.get("engine");
const INFLUXDB_URL = process.env.INFLUXDB_URL;

export class MetricsReporter {
    private static _instance: MetricsReporter;

    private readonly influx: InfluxDB = null;

    private constructor() {
        if(INFLUXDB_URL) {
            // Connect to a single host with a DSN:
            this.influx = new InfluxDB(INFLUXDB_URL);
        } else {
            logger.info(`Metrics reporting is disabled`);
        }
    }

    public static get Instance(): MetricsReporter {
        return this._instance || (this._instance = new this());
    }

    public report(measurement: string, point: IPoint, options: IWriteOptions = undefined) {
        this.reportMultiple(measurement, [point], options)
    }

    public reportMultiple(measurement: string, points: IPoint[], options: IWriteOptions = undefined) {
        if(this.influx) {
            this.influx.writeMeasurement(measurement, points, options)
                .then(
                    result => {
                        logger.error(`Successfully reporting metrics ${result}`);
                    },
                    error => {
                        logger.error(`Caught Error when reporting metrics ${error}`);
                    })
                .catch(error => {
                    logger.error(`Caught Error when reporting metrics ${error}`);
                });
        }
    }

}