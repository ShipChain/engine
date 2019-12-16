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
import { Project, Contract, Version } from '../src/entity/Contract';
import { Wallet } from '../src/entity/Wallet';
import { Logger } from '../src/Logger';

import compareVersions from 'compare-versions';

const typeorm = require('typeorm');
const config = require('config');
const test_net_utils = require('../src/local-test-net-utils');

const logger = Logger.get(module.filename);
const CONTRACT_FIXTURES_URL = config.get('CONTRACT_FIXTURES_URL');

// Latest supported versions of the contracts
const LATEST_SHIPTOKEN = '1.0.0';
import { latest as _LATEST_LOAD } from './Load/Latest';
import { latest as _LATEST_NOTARY } from './VaultNotary/Latest';

let LATEST_LOAD = _LATEST_LOAD;
let LATEST_NOTARY = _LATEST_NOTARY;

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

        logger.debug(`Registering ${project}:${version}`);

        if (!this.contracts.hasOwnProperty(project)) {
            this.contracts[project] = {};
        }

        if (this.contracts[project].hasOwnProperty(version)) {
            throw new Error(`Contract '${project}' version '${version}' already registered`);
        }

        this.contracts[project][version] = {
            latest: latest,
            contract: contract,
        };
    }

    public get(project: string, version?: string): BaseContract {
        logger.debug(`Retrieving ${project}:${version}`);

        if (!this.contracts.hasOwnProperty(project)) {
            throw new Error(`Contract '${project}' not registered`);
        }

        if (version === null || version === undefined) {
            for (let loadedVersion in this.contracts[project]) {
                if (this.contracts[project].hasOwnProperty(loadedVersion)) {
                    if (this.contracts[project][loadedVersion].latest) {
                        logger.debug(
                            `Retrieved ${project}:${loadedVersion} [${this.contracts[project][
                                loadedVersion
                            ].contract.getContractVersion()}]`,
                        );
                        return this.contracts[project][loadedVersion].contract;
                    }
                }
            }
            throw new Error(`Contract '${project}' has no latest version specified`);
        } else {
            if (!this.contracts[project].hasOwnProperty(version)) {
                throw new Error(`Contract '${project}' version '${version}' not registered`);
            }

            logger.debug(
                `Retrieved ${project}:${version} [${this.contracts[project][version].contract.getContractVersion()}]`,
            );
            return this.contracts[project][version].contract;
        }
    }

    public reset(): void {
        this.contracts = {};
    }
}

async function getNetwork(contractMetaData) {
    let network;

    // Or determine based on ENV environment setting
    if (config.get('DEPLOY_CONTRACTS')) {
        logger.info(`Deploying local contracts`);

        const deployedContracts = await test_net_utils.setupLocalTestNetContracts(
            { LOAD: LATEST_LOAD, ShipToken: LATEST_SHIPTOKEN, NOTARY: LATEST_NOTARY },
            await typeorm
                .getConnection()
                .getRepository(Wallet)
                .find(),
        );

        network = deployedContracts.LOAD.network.title;
    } else {
        // Override network from config
        if (config.has('GETH_NETWORK')) {
            network = config.get('GETH_NETWORK');
        } else {
            throw new Error('Unable to determine appropriate Ethereum Network!');
        }

        // Validate the latest Engine Supported version is deployed on the desired network
        if (!contractMetaData.ShipToken.deployed[network][LATEST_SHIPTOKEN]) {
            logger.warn(`ShipToken version ${LATEST_SHIPTOKEN} is not deployed to ${network}`);
        }

        if (!contractMetaData.LOAD.deployed[network] || !contractMetaData.LOAD.deployed[network][LATEST_LOAD]) {
            logger.warn(`LOAD version ${LATEST_LOAD} is not deployed to ${network}`);
            if (contractMetaData.LOAD.deployed[network]) {
                let testVersions = Object.keys(contractMetaData.LOAD.deployed[network])
                    .sort(compareVersions)
                    .reverse();
                LATEST_LOAD = testVersions[0];
                logger.warn(`Using latest ${network} version ${LATEST_LOAD}`);
            }
        }

        if (
            (LATEST_NOTARY && !contractMetaData.NOTARY.deployed) ||
            !contractMetaData.NOTARY.deployed[network] ||
            !contractMetaData.NOTARY.deployed[network][LATEST_NOTARY]
        ) {
            logger.warn(`NOTARY version ${LATEST_NOTARY} is not deployed to ${network}`);
            LATEST_NOTARY = null;
            if (contractMetaData.NOTARY.deployed && contractMetaData.NOTARY.deployed[network]) {
                let testVersions = Object.keys(contractMetaData.NOTARY.deployed[network])
                    .sort(compareVersions)
                    .reverse();
                LATEST_NOTARY = testVersions[0];
                logger.warn(`Using latest ${network} version ${LATEST_NOTARY}`);
            }
        }
    }

    return network;
}

export async function loadContractFixtures() {
    const contractPath = '../src/shipchain/contracts';
    const loadedContracts = LoadedContracts.Instance;
    const contractMetaData = await Project.loadFixturesFromUrl(CONTRACT_FIXTURES_URL);

    // Warn if the latest versions of the contracts don't match (likely means code update required)
    if (LATEST_LOAD !== contractMetaData.LOAD.latest) {
        logger.warn(
            `LOAD version in fixture [${contractMetaData.LOAD.latest}] does not match latest supported Engine contract [${LATEST_LOAD}]`,
        );
    }
    if (LATEST_NOTARY !== contractMetaData.NOTARY.latest) {
        logger.warn(
            `NOTARY version in fixture [${contractMetaData.NOTARY.latest}] does not match latest supported Engine contract [${LATEST_NOTARY}]`,
        );
    }

    let network = await getNetwork(contractMetaData);

    logger.info(`Loading Contracts from ${network}`);

    // Load and register ShipToken contract
    const TokenContract = (await import(`${contractPath}/ShipToken/${LATEST_SHIPTOKEN}/ShipTokenContract`))
        .ShipTokenContract;
    const TOKEN_CONTRACT = new TokenContract(network, LATEST_SHIPTOKEN);
    await TOKEN_CONTRACT.Ready;
    loadedContracts.register('ShipToken', TOKEN_CONTRACT, true);

    // Load and register LOAD contract
    const LoadContract = (await import(`${contractPath}/Load/${LATEST_LOAD}/LoadContract`)).LoadContract;
    const LOAD_CONTRACT = new LoadContract(network, LATEST_LOAD);
    await LOAD_CONTRACT.Ready;
    loadedContracts.register('LOAD', LOAD_CONTRACT, true);

    // Load and register NOTARY contract
    if (LATEST_NOTARY) {
        const VaultNotaryContract = (await import(`${contractPath}/VaultNotary/${LATEST_NOTARY}/VaultNotaryContract`))
            .VaultNotaryContract;
        const NOTARY_CONTRACT = new VaultNotaryContract(network, LATEST_NOTARY);
        await NOTARY_CONTRACT.Ready;
        loadedContracts.register('NOTARY', NOTARY_CONTRACT, true);
    }

    await registerPreviousLoadContracts(contractMetaData.LOAD.deployed[network], LOAD_CONTRACT);
}

async function registerPreviousLoadContracts(LoadMetaData, LOAD_CONTRACT: BaseContract) {
    const currentContract = LOAD_CONTRACT.getContractEntity();
    const loadedContracts = LoadedContracts.Instance;

    const previousContracts: Contract[] = await Contract.find({
        projectId: currentContract.projectId,
        networkId: currentContract.networkId,
        versionId: typeorm.Not(currentContract.versionId),
    });

    logger.debug(`Found ${previousContracts.length} previous Load contracts in DB`);

    for (let previousContract of previousContracts) {
        const previousVersion: Version = await Version.findOne({ id: previousContract.versionId });

        if (LoadMetaData && LoadMetaData[previousVersion.title]) {
            logger.info(
                `Registering previous '${currentContract.project.title}' contract version ${previousVersion.title}`,
            );

            const LoadContract = (await import(`../src/shipchain/contracts/Load/${previousVersion.title}/LoadContract`))
                .LoadContract;

            const oldLoadContract = new LoadContract(currentContract.network.title, previousVersion.title);
            await oldLoadContract.Ready;

            loadedContracts.register(currentContract.project.title, oldLoadContract);
        } else {
            logger.info(
                `Skipping previous '${currentContract.project.title}' contract version ${previousVersion.title} (not in fixture)`,
            );
        }
    }
}
