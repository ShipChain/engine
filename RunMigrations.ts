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

// Setup logging prior to any other imports
require("./loggingConfig");
import { Logger, loggers } from "winston";

import * as process from "process";
import { getRDSconfig } from "./rdsconfig";
import { Connection, createConnection, getConnectionOptions } from "typeorm";

// @ts-ignore
const logger: Logger = loggers.get("engine");

/**
 * This logic is borrowed from TyprOrm's CLI package for running migrations
 * A modification was required to support pulling in our RDS configuration asynchronously.
 */
class Migration {

    static async run() {

        let connection: Connection | undefined = undefined;
        try {

            const defaultOptions = await getConnectionOptions();
            const rdsOptions = await getRDSconfig();

            const fullOptions = Object.assign(
                {},
                defaultOptions,
                rdsOptions,
                {
                    subscribers: [],
                    synchronize: false,
                    migrationsRun: false,
                    dropSchema: false,
                    logging: ["query", "error", "schema"]
                });

            connection = await createConnection(fullOptions);

            const options = { transaction: true };
            await connection.runMigrations(options);
            await connection.close();

            // exit process if no errors
            process.exit(0);

        } catch (err) {
            if (connection) await (connection as Connection).close();

            logger.error(`Error during migration run: ${err}`);
            process.exit(1);
        }
    }
}


try {
    Migration.run();
} catch (_err) {
    logger.error(`Error during migration run: ${_err}`);
}
