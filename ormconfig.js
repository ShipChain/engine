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

const entities = [__dirname + "/src/entity/*.ts"];
const subscribers = [__dirname + "/src/subscriber/*.ts"];
const migrations = [__dirname + "/src/migration/*.ts"];

const cli = {
  "entitiesDir": "src/entity",
  "migrationsDir": "src/migration",
  "subscribersDir": "src/subscriber"
};

const rdsUrl = process.env.DATABASE_URL || `psql://engine:engine@psql:5432/engine`;

module.exports = {
  "name": "default",
  "type": "postgres",
  "url": rdsUrl,
  "synchronize": true,
  "logging": false,
  "entities": entities,
  "subscribers": subscribers,
  "migrations": migrations,
  "cli": cli
};
