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

import { Logger } from '../Logger';

const logger = Logger.get(module.filename);

export async function getAwsSecret(secretName: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        logger.verbose(`Getting ${secretName} from AWS`);

        const AWS = require('aws-sdk');
        const endpoint = 'https://secretsmanager.us-east-1.amazonaws.com';
        const region = 'us-east-1';

        let secretJson = null;

        // Create a Secrets Manager client
        const client = new AWS.SecretsManager({
            apiVersion: '2017-10-17',
            endpoint: endpoint,
            region: region,
        });

        client.getSecretValue({ SecretId: secretName }, function(err, data) {
            if (err) {
                if (err.code === 'ResourceNotFoundException') {
                    logger.error(`The requested secret ${secretName} was not found`);
                } else if (err.code === 'InvalidRequestException') {
                    logger.error(`The request was invalid due to: ${err.message}`);
                } else if (err.code === 'InvalidParameterException') {
                    logger.error(`The request had invalid params: ${err.message}`);
                }

                reject(`Unable to get ${secretName}: ${err}`);
            }

            secretJson = data.SecretString;
            const secret = JSON.parse(secretJson);

            resolve(secret);
        });
    });
}
