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

import { Logger as WinstonLogger, format, transports, loggers } from 'winston';

const uuidv4 = require('uuid/v4');
const appRoot = require('app-root-path');
const path = require('path');
const ElasticSearch = require('winston-elasticsearch');
const WinstonCloudWatch = require('winston-cloudwatch');
const config = require('config');

/**
 * We're using the default npm levels
 *   error: 0,
 *   warn: 1,
 *   info: 2,
 *   verbose: 3,
 *   debug: 4,
 *   silly: 5
 */

const ENGINE_LOGGER_NAME = 'engine';
const ENV = config.util.getEnv('NODE_CONFIG_ENV');

const LOGGING_LEVEL = config.get("LOGGING_LEVEL");
const CLOUDWATCH_LEVEL = config.get("CLOUDWATCH_LEVEL");
const ELASTICSEARCH_LEVEL = config.get("ELASTICSEARCH_LEVEL");


const PROCESS_UNIQUENESS = uuidv4();

export class Logger {
    private readonly filename: string;
    private logger: WinstonLogger;

    constructor(logger: WinstonLogger, filename: string) {
        this.logger = logger;
        this.filename = Logger.getRelativeFilename(filename);
    }

    static get(filename: string, id: string = ENGINE_LOGGER_NAME): Logger {
        if (!loggers.has(id)) {
            Logger.define_loggers();
        }
        const logger = loggers.get(id);
        return new Logger(logger, filename);
    }

    private static getRelativeFilename(filename: string): string {
        return filename.replace(appRoot + path.sep, '');
    }

    private getMeta(args: any, depth: number = 1): { filename: string; [key: string]: any } {
        let meta = { filename: this.filename };

        if (args.length > depth) {
            meta = Object.assign(meta, args[depth]);
        }

        return meta;
    }

    // Override the logging methods on Winston's Logger class
    // ======================================================
    log(level, ...args) {
        this.logger.log(level, args[0], this.getMeta(args));
    }
    error(...args) {
        this.logger.error(args[0], this.getMeta(args));
    }
    warn(...args) {
        this.logger.warn(args[0], this.getMeta(args));
    }
    info(...args) {
        this.logger.info(args[0], this.getMeta(args));
    }
    verbose(...args) {
        this.logger.verbose(args[0], this.getMeta(args));
    }
    debug(...args) {
        this.logger.debug(args[0], this.getMeta(args));
    }
    silly(...args) {
        this.logger.silly(args[0], this.getMeta(args));
    }

    // Build Transport formatters that inject our meta filename
    // ========================================================
    private static logElasticSearchFormat(logData) {
        const transformed = {};
        transformed['@timestamp'] = logData.timestamp ? logData.timestamp : new Date().toISOString();
        transformed['message'] = logData.message;
        transformed['severity'] = logData.level;
        transformed['fields'] = {
            Environment: ENV,
            filename: logData.meta.filename,
        };
        return transformed;
    }

    private static logCloudWatchFormat(logData) {
        const transformed = {};
        transformed['@timestamp'] = logData.timestamp ? logData.timestamp : new Date().toISOString();
        transformed['message'] = logData.message;
        transformed['severity'] = logData.level;
        transformed['fields'] = {
            Environment: ENV,
            filename: logData.filename,
        };
        return JSON.stringify(transformed, null, '  ');
    }

    private static logLineFormat(logData: { level: string; message: string; [key: string]: any }): string {
        // [${logData.metadata.filename}]
        return `${logData.timestamp ? logData.timestamp + ' ' : ''}${logData.level} ${logData.message}`;
    }

    // Generate the common Winston logger
    // ==================================
    private static define_loggers() {
        let engine_transports = [];
        let es_enabled = false;
        let cw_enabled = false;

        // Always include the Console Transport
        // ------------------------------------
        engine_transports.push(
            new transports.Console({
                format: format.combine(
                    // format.timestamp(),
                    format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'filename'] }),
                    format.cli(),
                    format.printf(Logger.logLineFormat),
                ),
            }),
        );

        // Add ElasticSearch if we're running in a deployed environment
        // ------------------------------------------------------------
        if (config.has("ELASTICSEARCH_URL")) {
            const ELASTICSEARCH_URL : string = config.get("ELASTICSEARCH_URL");
            es_enabled = true;

            engine_transports.push(
                new ElasticSearch({
                    level: ELASTICSEARCH_LEVEL,
                    indexPrefix: 'engine',
                    transformer: Logger.logElasticSearchFormat,
                    // clientOpts are parameters to the ElasticSearch Client
                    // https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html
                    clientOpts: {
                        host: ELASTICSEARCH_URL,
                    },
                }),
            );
        }

        // Add CloudWatch if we're running in a deployed environment
        // ---------------------------------------------------------
        if (ENV === 'DEV' || ENV === 'STAGE' || ENV === 'DEMO' || ENV === 'PROD') {
            cw_enabled = true;

            engine_transports.push(
                new WinstonCloudWatch({
                    level: CLOUDWATCH_LEVEL,
                    messageFormatter: Logger.logCloudWatchFormat,
                    logGroupName: `engine-node-${ENV}`,
                    logStreamName: function() {
                        // Spread log streams across dates as the server stays up
                        let date = new Date().toISOString().split('T')[0];
                        return 'rpc-server-' + date + '-' + PROCESS_UNIQUENESS;
                    },
                    awsRegion: 'us-east-1',
                }),
            );
        }

        const initializationMeta = { filename: Logger.getRelativeFilename(module.filename) };

        loggers
            .add(ENGINE_LOGGER_NAME, {
                format: format.json(),
                level: LOGGING_LEVEL,
                exitOnError: true,
                transports: engine_transports,
            })
            .verbose('Logging Initialized', initializationMeta);

        if (!es_enabled) {
            loggers.get(ENGINE_LOGGER_NAME).warn('Logs are not being sent to ElasticSearch', initializationMeta);
        }
        if (!cw_enabled) {
            loggers.get(ENGINE_LOGGER_NAME).warn('Logs are not being sent to CloudWatch', initializationMeta);
        }
    }
}
