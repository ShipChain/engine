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

const config = require('config');

let dir = "src";
let ext = "ts";

if (config.get("USE_JS_ORM_ENTITIES")) {
  dir = "dist/src";
  ext = "js";
}

const entities = [__dirname + `/${dir}/entity/*.${ext}`];
const migrations = [__dirname + `/${dir}/entity/migration/*.${ext}`];
const subscribers = [__dirname + `/${dir}/subscriber/*.${ext}`];

const cli = {
  "entitiesDir": `${dir}/entity`,
  "migrationsDir": `${dir}/entity/migration`,
  "subscribersDir": `${dir}/subscriber`
};

const rdsUrl = config.get("DATABASE_URL");

module.exports = {
  "name": "default",
  "type": "postgres",
  "url": rdsUrl,
  "synchronize": false,
  "logging": false,
  "entities": entities,
  "subscribers": subscribers,
  "migrations": migrations,
  "cli": cli
};
