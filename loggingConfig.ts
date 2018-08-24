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

const { format, loggers, transports } = require("winston");

const ENV = process.env.ENV || "LOCAL";

/**
 * We're using the default npm levels
 *   error: 0,
 *   warn: 1,
 *   info: 2,
 *   verbose: 3,
 *   debug: 4,
 *   silly: 5
 */
const LOGGING_LEVEL = process.env.LOGGING_LEVEL || "info";
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_LEVEL = process.env.ELASTICSEARCH_LEVEL || LOGGING_LEVEL;


let engine_transports = [];

// Always include the Console Transport with simple format at the parent logger level
engine_transports.push(
    new transports.Console({ format: format.simple() })
);

// Add ElasticSearch if we're running in a deployed environment
if ((ENV === "DEV" || ENV === "STAGE" || ENV === "PROD") &&
    ELASTICSEARCH_URL != null) {

    const ElasticSearch = require("winston-elasticsearch");

    /**
     Transformer function to transform log data as provided by winston into
     a message structure which is more appropriate for indexing in ES.
     @param {Object} logData
     @param {Object} logData.message - the log message
     @param {Object} logData.level - the log level
     @param {Object} logData.meta - the log meta data (JSON object)
     @returns {Object} transformed message
     */
    const transformer = function transformer(logData) {
        const transformed = {};
        transformed["@timestamp"] = logData.timestamp ? logData.timestamp : new Date().toISOString();
        transformed["message"] = logData.message;
        transformed["severity"] = logData.level;
        transformed["fields"] = Object.assign({}, logData.meta, { "Environment": ENV });
        return transformed;
    };

    engine_transports.push(
        new (ElasticSearch)({
            level: ELASTICSEARCH_LEVEL,
            indexPrefix: "engine",
            transformer: transformer,

            // clientOpts are parameters to the ElasticSearch Client
            // https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html
            clientOpts: {
                host: ELASTICSEARCH_URL
            }
        })
    );
} else {
    console.warn("Logs are not being sent to ElasticSearch");
}

loggers.add("engine", {
    format: format.json(),
    level: LOGGING_LEVEL,
    exitOnError: true,
    transports: engine_transports
}).verbose("Logging Initialized");

