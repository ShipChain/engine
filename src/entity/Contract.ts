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

import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';

import { Logger } from '../Logger';
import { MetricsReporter } from '../MetricsReporter';
import { GasPriceOracle } from '../GasPriceOracle';
import { EthereumService } from '../eth/EthereumService';
import { EthersEthereumService } from '../eth/ethers/EthersEthereumService';

const fs = require('fs');
const EthereumTx = require('ethereumjs-tx');
const requestPromise = require('request-promise-native');

const logger = Logger.get(module.filename);
const metrics = MetricsReporter.Instance;
const gasPriceOracle = GasPriceOracle.Instance;

@Entity()
export class Project extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @CreateDateColumn() createdDate: Date;

    @Column() title: string;
    @Column() description: string;

    @OneToMany(type => Contract, contract => contract.project)
    contracts: Contract[];
    @OneToMany(type => Version, version => version.project)
    versions: Version[];

    static async getOrCreate(title: string, description: string) {
        let project = await Project.findOne({ title });
        if (!project) {
            project = new Project();
            project.title = title;
            project.description = description;
            await project.save();
        }
        return project;
    }

    static async loadFixtureMetaData(meta: any): Promise<any> {
        const networks = {};
        const contracts = {};

        return new Promise(async (resolve, reject) => {
            try {
                // Parse defined Networks
                for (let networkName of Object.keys(meta.networks)) {
                    const network = meta.networks[networkName];

                    networks[networkName] = await Network.getOrCreate(networkName, network.description);
                    logger.debug(
                        `Fixture Network: ${networkName} ${network.description} [${networks[networkName].id}]`,
                    );
                }

                // Parse defined Contracts
                for (let contractName of Object.keys(meta.contracts)) {
                    const versions = {};

                    const contractData = meta.contracts[contractName];
                    contracts[contractName] = contractData;

                    // Create Project
                    const project = await Project.getOrCreate(contractName, contractData.description);
                    logger.debug(`Fixture Project: ${contractName} [${project.id}]`);

                    // Create Versions using ABI and BIN of each Contract
                    for (let versionName of Object.keys(contractData.versions)) {
                        const versionData = contractData.versions[versionName];
                        const parsedAbi = JSON.parse(versionData.abi);
                        versions[versionName] = await Version.getOrCreate(
                            project,
                            versionName,
                            parsedAbi,
                            versionData.bin,
                        );
                        logger.debug(`Fixture Version: ${project.title} ${versionName} [${versions[versionName].id}]`);

                        // Remove abi/bin after Version is created so we don't return these large blobs
                        delete versionData.abi;
                        delete versionData.bin;
                    }

                    // Create Contract from Project, Network, and Version
                    for (let networkName of Object.keys(contractData.deployed)) {
                        const networkVersion = contractData.deployed[networkName];

                        // Each Contract Network can have multiple historical versions
                        for (let versionName of Object.keys(networkVersion)) {
                            const contractAddress = networkVersion[versionName];
                            const contract = await Contract.getOrCreate(
                                project,
                                networks[networkName],
                                versions[versionName],
                                contractAddress,
                            );
                            logger.debug(
                                `Fixture Contract: ${project.title} ${networkName} ${versionName} ${contractAddress} [${contract.id}]`,
                            );
                        }
                    }
                }

                resolve(contracts);
            } catch (err) {
                logger.error(`Parsing Fixtures returned ${err}`);
                reject(err);
            }
        });
    }

    static async loadFixturesFromFile(fixture_file: string): Promise<any> {
        const meta = JSON.parse(fs.readFileSync(fixture_file));
        return await Project.loadFixtureMetaData(meta);
    }

    static async loadFixturesFromUrl(fixture_url: string): Promise<any> {
        const requestOptions = {
            uri: fixture_url,
            json: true,
            timeout: 20000,
        };

        try {
            const meta = await requestPromise(requestOptions);
            return await Project.loadFixtureMetaData(meta);
        } catch (err) {
            logger.error(`Retrieving Fixtures returned ${err}`);
            throw err;
        }
    }
}

@Entity('version', {
    orderBy: {
        title: 'DESC',
    },
})
export class Version extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @ManyToOne(type => Project, project => project.versions)
    @JoinColumn()
    project: Project;
    @Column() projectId: string;

    @OneToMany(type => Contract, contract => contract.version)
    contracts: Contract[];

    @Column() title: string;
    @Column() abi: string;
    @Column({ nullable: true })
    bytecode: string;

    static async getByProjectAndTitle(project_title, version: string) {
        let project = await Project.findOne({ title: project_title });

        if (!project) {
            logger.error(`Unable to find existing ${project_title}:${version}`);
            throw new Error(`${project_title} Version ${version} cannot be found`);
        }

        return await Version.findOne({ project: project, title: version });
    }

    static async getOrCreate(project, title, abi, bytecode) {
        let version = await Version.findOne({ project, title });
        if (!version) {
            if (Array.isArray(abi)) abi = JSON.stringify(abi);

            version = new Version();
            version.project = project;
            version.title = title;
            version.abi = abi;
            version.bytecode = bytecode;
            await version.save();
        }
        return version;
    }

    async deployToLocalTestNet(): Promise<Contract> {
        const project = this.project || (await Project.findOne({ id: this.projectId }));

        const network = await Network.getLocalTestNet();

        logger.info(`Deploy to local: ${project.title} ${this.title}`);

        const contract = await Contract.getOrCreate(project, network, this);

        const ethereumService = network.getEthereumService();

        if (contract.address) {
            const code = await ethereumService.getCode(contract.address);
            if (code != 0x0 && code != '0x') {
                logger.debug(`Already Deployed to ${contract.address}!`);
                return contract;
            }
        }

        const parsed_abi = this.getABI();

        const deployedContractResult = await ethereumService.deployContract(parsed_abi, this.bytecode);

        contract.address = deployedContractResult.address;
        contract.deploy_date = new Date();
        contract.deploy_author = deployedContractResult.author;
        contract.deploy_tx_id = deployedContractResult.hash;
        await contract.save();

        return contract;
    }

    getABI() {
        return JSON.parse(this.abi);
    }
}

export abstract class GenericCallback {
    abstract call(method: string, args: any[]);
}

@Entity()
export class Network extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @OneToMany(type => Contract, contract => contract.network)
    contracts: Contract[];

    @Column() title: string;
    @Column() description: string;

    private _ethereumService: EthereumService;

    static async getOrCreate(title: string, description: string) {
        let network = await Network.findOne({ title });
        if (!network) {
            network = new Network();
            network.title = title;
            network.description = description;
            await network.save();
        } else if (network.description !== description) {
            network.description = description;
            await network.save();
        }
        return network;
    }

    static async getLocalTestNet() {
        return await Network.getOrCreate('local', 'Local Test Net');
    }

    getEthereumService(): EthereumService {
        if (this._ethereumService) return this._ethereumService;

        this._ethereumService = new EthersEthereumService();
        return this._ethereumService;
    }

    async send_tx(signed_tx, callbacks?: GenericCallback) {
        signed_tx = new EthereumTx(signed_tx);
        const raw = '0x' + signed_tx.serialize().toString('hex');
        const ethereumService = this.getEthereumService();
        const startTime = Date.now();
        return new Promise((resolve, reject) =>
            ethereumService.sendSignedTransaction(raw, {
                receipt: receipt => {
                    metrics.methodTime('send_tx_receipt', Date.now() - startTime, { web3: true });
                    resolve(receipt);
                },
                confirmation: obj => {
                    if (callbacks) {
                        callbacks.call('confirmation', [obj]);
                    }
                },
                error: err => {
                    if (callbacks) {
                        callbacks.call('error', [err]);
                    }
                    reject(err);
                },
            }),
        );
    }
}

@Entity()
export class Contract extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @ManyToOne(type => Project, project => project.contracts)
    @JoinColumn()
    project: Project;
    @Column() projectId: string;

    @ManyToOne(type => Version, version => version.contracts)
    @JoinColumn()
    version: Version;
    @Column() versionId: string;

    @ManyToOne(type => Network, network => network.contracts)
    @JoinColumn()
    network: Network;
    @Column() networkId: string;

    @Column({ nullable: true })
    address: string;

    @Column({ nullable: true })
    deploy_date: Date;

    @Column({ nullable: true })
    deploy_tx_id: string;
    @Column({ nullable: true })
    deploy_author: string;

    private _driver;

    static async getOrCreate(project: Project, network: Network, version: Version, address?: string) {
        let contract = await Contract.findOne({ project, network, version });
        if (!contract) {
            contract = new Contract();
            contract.project = project;
            contract.network = network;
            contract.version = version;
            contract.address = address;
            await contract.save();
        }
        return contract;
    }

    static async getContractVersion(project_title: string, network_title: string, version_title: string) {
        let project = await Project.findOne({ title: project_title });
        let network = await Network.findOne({ title: network_title });
        if (!project || !network) {
            logger.error(`Unable to find existing ${project_title}:${network_title}:${version_title}`);
            return;
        }

        let version;
        if (version_title) version = await Version.findOne({ title: version_title, project });
        else version = await Version.findOne({ project });

        if (!version) {
            logger.error(`Unable to find existing ${project_title}:${network_title}:${version_title}`);
            return;
        }
        return await Contract.findOne({
            relations: ['network', 'version', 'project'],
            where: { network, version, project },
        });
    }

    async getContractInstance() {
        if (this._driver) return this._driver;

        this.network = this.network || (await Network.findOne({ id: this.networkId }));
        this.version = this.version || (await Version.findOne({ id: this.versionId }));

        const ethereumService = this.network.getEthereumService();

        this._driver = ethereumService.createContractInstance(this.version.getABI(), this.address);
        return this._driver;
    }

    async call_static(method: string, args: any[]) {
        const ethereumService = this.network.getEthereumService();
        const contractInstance = await this.getContractInstance();

        const startTime = Date.now();
        const response = await ethereumService.callStaticMethod(contractInstance, method, args);
        metrics.methodTime('call_static', Date.now() - startTime, { contract_method: method, web3: true });

        return response;
    }

    async build_transaction(methodName: string, args: any[], options?: any) {
        if (!options) options = {};

        this.network = this.network || (await Network.findOne({ id: this.networkId }));

        const contractInstance = await this.getContractInstance();
        const ethereumService = await this.network.getEthereumService();

        const unsignedTx = await ethereumService.encodeTransaction(contractInstance, methodName, args);

        let estimatedGas = 500000;
        try {
            estimatedGas = await ethereumService.estimateTransaction(contractInstance, methodName, args);
        } catch (err) {
            logger.warn(`Gas Estimation Failed: ${err}.  Falling back to ${estimatedGas}`);
        }

        return {
            ...unsignedTx,
            to: this.address,
            gasPrice: ethereumService.toHex(options.gasPrice || gasPriceOracle.gasPrice),
            gasLimit: ethereumService.toHex(options.gasLimit || estimatedGas),
            value: ethereumService.toHex(options.value || 0),
        };
    }
}
