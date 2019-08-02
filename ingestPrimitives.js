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

const fs = require("fs");
const request = require("request");


// Setup the source URL for the Primitive JSONSchema
const schemaBaseUrl = "http://schema.shipchain.io/";
const schemaVersion = "1.2.1";
const schemas = [
  "shipment"
];


// Retrieve all the Primitive JSONSchema definitions, capture for validators, and generate TypeScript Interfaces
for (schema of schemas) {
  request.get(schemaBaseUrl + schemaVersion + "/" + schema + ".json", function(error, response, schemaString) {

    if (error) {
      throw error;
    }

    if (!error && response.statusCode === 200) {

      // Capture the schema for building validators
      fs.writeFileSync("rpc/primitives/schema/" + schema + ".json", schemaString);

    }
  });
}
