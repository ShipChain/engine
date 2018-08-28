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

import { BaseContract } from '../src/contracts/BaseContract';
import { Logger, loggers } from 'winston';
import { Project } from '../src/entity/Contract';
import { Wallet } from '../src/entity/Wallet';
import { TokenContract } from '../src/shipchain/TokenContract';
import { LoadContract } from '../src/shipchain/LoadContract';

const typeorm = require('typeorm');
const test_net_utils = require('../src/local-test-net-utils');

// @ts-ignore
const logger: Logger = loggers.get('engine');
const ENV = process.env.ENV || 'LOCAL';

export class LoadedContracts {
    private static _instance: LoadedContracts;

    private contracts: any;

    private constructor() {
        this.contracts = {};
    }

    public static get Instance(): LoadedContracts {
        return this._instance || (this._instance = new this());
    }

    public register(project: string, contract: BaseContract, latest: boolean = false) {
        const version = contract.getContractVersion();

        if (!this.contracts.hasOwnProperty(project)) {
            this.contracts[project] = {};
        }

        if (this.contracts[project].hasOwnProperty(version)) {
            const message = `Contract '${project}' version '${version}' already loaded`;
            logger.error(message);
            throw new Error(message);
        }

        this.contracts[project][version] = {
            latest: latest,
            contract: contract,
        };
    }

    public get(project: string, version?: string): BaseContract {
        if (!this.contracts.hasOwnProperty(project)) {
            throw new Error(`Contract '${project}' not loaded`);
        }

        if (version === null || version === undefined) {
            for (let loadedVersion in this.contracts[project]) {
                if (this.contracts[project].hasOwnProperty(loadedVersion)) {
                    if (this.contracts[project][loadedVersion].latest) {
                        return this.contracts[project][loadedVersion].contract;
                    }
                }
            }

            const message = `Contract '${project}' has no latest version specified`;
            logger.error(message);
            throw new Error(message);
        } else {
            if (!this.contracts[project].hasOwnProperty(version)) {
                const message = `Contract '${project}' version '${version}' not loaded`;
                logger.error(message);
                throw new Error(message);
            }

            return this.contracts[project][version].contract;
        }
    }
}

export async function loadContractFixtures() {
    let TOKEN_CONTRACT;
    let LOAD_CONTRACT;

    const loadedContracts = LoadedContracts.Instance;

    await Project.loadFixtures('/contracts');

    if (ENV === 'DEV' || ENV === 'LOCAL') {
        const GETH_NODE = process.env.GETH_NODE || 'localhost:8545';
        logger.info(`Loading Contracts from ${GETH_NODE}`);
        const [web3, network, token, load] = await test_net_utils.setupLocalTestNetContracts(
            GETH_NODE,
            await typeorm
                .getConnection()
                .getRepository(Wallet)
                .find(),
        );
        TOKEN_CONTRACT = new TokenContract(token.network.title, token.version.title);
        LOAD_CONTRACT = new LoadContract(load.network.title, load.version.title);
    } else if (ENV === 'STAGE') {
        logger.info('Loading Contracts from Ropsten');
        TOKEN_CONTRACT = new TokenContract('ropsten', '1.0');
        LOAD_CONTRACT = new LoadContract('ropsten', '1.0.2');
    } else if (ENV === 'PROD') {
        logger.info('Loading Contracts from Main');
        TOKEN_CONTRACT = new TokenContract('main', '1.0');
        LOAD_CONTRACT = new LoadContract('main', '1.0.2');
    } else {
        throw new Error('Unable to determine appropriate Ethereum Network!');
    }

    await TOKEN_CONTRACT.Ready;
    await LOAD_CONTRACT.Ready;

    loadedContracts.register('LOAD', LOAD_CONTRACT, true);
    loadedContracts.register('Token', TOKEN_CONTRACT, true);
}