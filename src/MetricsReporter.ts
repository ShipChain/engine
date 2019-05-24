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

import { InfluxDB, IPoint, IWriteOptions } from 'influx';
import { Logger } from './Logger';
const config = require('config');

const logger = Logger.get(module.filename);
const ENVIRONMENT =  config.util.getEnv('NODE_CONFIG_ENV');

export class MetricsReporter {
    private static _instance: MetricsReporter;

    private readonly influx: InfluxDB = null;

    protected constructor() {
        if (config.has('INFLUXDB_URL')) {
            const INFLUXDB_URL = config.get('INFLUXDB_URL');
            // Connect to a single host with a DSN:
            this.influx = new InfluxDB(INFLUXDB_URL);
            logger.info(`Metrics reporting is enabled`);
        } else {
            logger.warn(`Metrics reporting is disabled`);
        }
    }

    public static get Instance(): MetricsReporter {
        return this._instance || (this._instance = new this());
    }

    protected static buildPoint(tags: any = {}, fields: any = {}) {
        let defaultPoint = {
            tags: {
                environment: ENVIRONMENT,
            },
            fields: {
                count: 1,
            },
        };

        return {
            tags: Object.assign(defaultPoint.tags, tags),
            fields: Object.assign(defaultPoint.fields, fields),
            timestamp: new Date(),
        };
    }

    public methodCall(method: string) {
        const point = MetricsReporter.buildPoint({ method: method });

        this.report('engine.method_invocation', point);
    }

    public methodFail(method: string) {
        const point = MetricsReporter.buildPoint({ method: method });

        this.report('engine.method_failure', point);
    }

    public methodTime(method: string, time_delta: number, tags: any = {}) {
        const point = MetricsReporter.buildPoint(Object.assign({ method: method }, tags), { time_delta: time_delta });

        this.report('engine.method_time', point);
    }

    public countAction(action: string, tags: any = {}) {
        const point = MetricsReporter.buildPoint(Object.assign({ action: action }, tags));

        this.report('engine.action_count', point);
    }

    public entityTotal(entity: string, count: number) {
        const point = MetricsReporter.buildPoint({ entity: entity }, { count: count });

        this.report('engine.entity_total', point);
    }

    protected report(measurement: string, point: IPoint, options: IWriteOptions = undefined) {
        this.reportMultiple(measurement, [point], options);
    }

    protected reportMultiple(measurement: string, points: IPoint[], options: IWriteOptions = undefined) {
        // Later we can add in caching of points to send in bulk
        // and handling a backlog of points that failed to report
        if (this.influx) {
            this.influx
                .writeMeasurement(measurement, points, options)
                .then(
                    result => {},
                    error => {
                        logger.error(`Error when reporting metrics ${error}`);
                    },
                )
                .catch(error => {
                    logger.error(`Error when reporting metrics ${error}`);
                });
        }
    }
}
