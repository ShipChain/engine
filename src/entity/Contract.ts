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
import { Logger, loggers } from 'winston';

const fs = require('fs');
const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx');
const rp = require('request-promise-native');

// @ts-ignore
const logger: Logger = loggers.get('engine');

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

    static async loadFixturesFromDirectory(fixture_path: string) {
        const meta = JSON.parse(fs.readFileSync(fixture_path + '/index.json'));
        const networks = {};
        for (let title of Object.keys(meta.networks)) {
            const nData = meta.networks[title];
            networks[title] = await Network.getOrCreate(title, nData.public_address, nData.description);
        }

        for (let title of Object.keys(meta.contracts)) {
            const cData = meta.contracts[title];
            const project = await Project.getOrCreate(title, cData.description);
            const versions = {};
            for (let network_title of Object.keys(cData.deployed)) {
                const dData = cData.deployed[network_title];
                const version_path = `${fixture_path}/contracts/${title}/${dData.version}`;
                const bytecode = '0x' + fs.readFileSync(`${version_path}/compiled.bin`);
                const version = await Version.getOrCreate(project, dData.version, dData.abi, bytecode);
                versions[dData.version] = version;
                await Contract.getOrCreate(project, networks[network_title], version, dData.address);
            }
        }
    }

    static async loadFixturesFromUrl(fixture_url: string) {

        return new Promise((resolve, reject) => {
            const requestOptions = {
                uri: fixture_url,
                json: true,
                timeout: 20000,
            };

            rp(requestOptions)
                .then(async meta => {
                    const networks = {};
                    const contracts = {};

                    try {
                        // Parse defined Networks
                        for (let networkName of Object.keys(meta.networks)) {
                            const network = meta.networks[networkName];

                            networks[networkName] = await Network.getOrCreate(networkName, network.public_address, network.description);
                            logger.debug(`Fixture Network: ${networkName} ${network.public_address} ${network.description} [${networks[networkName].id}]`);
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
                                versions[versionName] = await Version.getOrCreate(project, versionName, parsedAbi, versionData.bin);
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
                                    const contract = await Contract.getOrCreate(project, networks[networkName], versions[versionName], contractAddress);
                                    logger.debug(`Fixture Contract: ${project.title} ${networkName} ${versionName} ${contractAddress} [${contract.id}]`);
                                }
                            }
                        }
                    } catch (err) {
                        logger.error(`Parsing Fixtures returned ${err}`);
                        reject(err);
                    }

                    resolve(contracts);
                })
                .catch(err => {
                    logger.error(`Retrieving Fixtures returned ${err}`);
                    reject(err);
                });
        });

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

    async deployToLocalTestNet(nodeUrl: string) {
        const project = this.project || (await Project.findOne({ id: this.projectId }));

        const network = await Network.getLocalTestNet(nodeUrl);

        logger.info(`Deploy to local: ${project.title} ${this.title} ${network.connection_string}`);

        const contract = await Contract.getOrCreate(project, network, this);

        const eth = network.getDriver().eth;

        if (contract.address) {
            const code = await eth.getCode(contract.address);
            if (code != 0x0 && code != '0x') {
                logger.debug(`Already Deployed to ${contract.address}!`);
                return new Promise(resolve => {
                    resolve(contract);
                });
            }
        }

        const parsed_abi = this.getABI();

        const driver = new eth.Contract(parsed_abi);

        // const await_accounts = await eth.getAccounts();

        return new Promise((resolve, reject) => {
            eth.getAccounts((err, acc) => {
                if (err) {
                    reject(err);
                } else {
                    let account = acc[0];
                    logger.debug(`\tLocal Test Net Account: ${account}`);
                    driver
                        .deploy({ data: this.bytecode })
                        .send({ from: account, gasLimit: 8000000 }, (err, tx_hash) => {
                            contract.deploy_tx_id = tx_hash;
                            logger.debug(`\tDeploy TX ID: ${tx_hash}`);
                        })
                        .on('receipt', receipt => {
                            logger.debug('\tDeploy Address:', receipt.contractAddress);
                            contract.address = receipt.contractAddress;
                            contract.deploy_date = new Date();
                            contract.deploy_author = account;
                            contract.save().then(() => resolve(contract));
                        })
                        .on('error', reject);
                }
            });
        });
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
    @Column() connection_string: string;
    @Column() description: string;

    private _driver;

    static async getOrCreate(title: string, connection_string: string, description: string) {
        let network = await Network.findOne({ title });
        if (!network) {
            network = new Network();
            network.title = title;
            network.description = description;
            network.connection_string = connection_string;
            await network.save();
        } else if (network.connection_string !== connection_string || network.description !== description) {
            network.description = description;
            network.connection_string = connection_string;
            await network.save();
        }
        return network;
    }

    static async getLocalTestNet(nodeUrl: string) {
        return await Network.getOrCreate('local', nodeUrl, 'Local Test Net');
    }

    static async getLocalTestNetAccounts(nodeUrl: string) {
        const local_net = await Network.getLocalTestNet(nodeUrl);
        return await new Promise((resolve, reject) => {
            local_net.getDriver().eth.getAccounts((err, accounts) => {
                if (err) reject(err);
                else resolve(accounts);
            });
        });
    }

    getDriver() {
        if (this._driver) return this._driver;
        return (this._driver = new Web3(new Web3.providers.HttpProvider(this.connection_string)));
    }

    async send_tx(signed_tx, callbacks?: GenericCallback) {
        signed_tx = new EthereumTx(signed_tx);
        const raw = '0x' + signed_tx.serialize().toString('hex');
        const driver = this.getDriver();
        return new Promise((resolve, reject) =>
            driver.eth
                .sendSignedTransaction(raw)
                .on('receipt', receipt => {
                    resolve(receipt);
                })
                .on('confirmation', (num, obj) => {
                    if (callbacks) {
                        callbacks.call('confirmation', [num, obj]);
                    }
                })
                .on('error', err => {
                    if (callbacks) {
                        callbacks.call('error', [err]);
                    }
                    reject(err);
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

    async getDriver() {
        if (this._driver) return this._driver;
        this.network = this.network || (await Network.findOne({ id: this.networkId }));
        this.version = this.version || (await Version.findOne({ id: this.versionId }));

        const eth = this.network.getDriver().eth;

        return (this._driver = new eth.Contract(this.version.getABI(), this.address));
    }

    async encodeMethod(method, args) {
        const driver = await this.getDriver();
    }

    async call_static(method: string, args: any[]) {
        const driver = await this.getDriver();
        return await driver.methods[method](...args).call();
    }

    async build_transaction(methodName: string, args: any[], options?: any) {
        this.network = this.network || (await Network.findOne({ id: this.networkId }));

        // const web3_driver = this.network.getDriver();
        const driver = await this.getDriver();

        const contractMethod = driver.methods[methodName](...args);
        // Estimating Gas is causing errors on multiple occasions
        // For now I'm leaving this out so development can continue
        // ========================================================
        // let estimatedGas = await contractMethod.estimateGas({from: this.address, gas: 5000000});
        // if(estimatedGas == 5000000){
        //     throw new Error("Transaction out of gas");
        // }
        // estimatedGas += 21000;
        // estimatedGas *=  1.2;
        let estimatedGas = 500000;

        const encoded = contractMethod.encodeABI();

        if (!options) options = {};

        const hex_i = i => (Number.isInteger(i) ? Web3.utils.toHex(i) : i);

        return {
            to: this.address,
            gasPrice: hex_i(options.gasPrice || 20 * 10 ** 9),
            gasLimit: hex_i(options.gasLimit || estimatedGas),
            value: hex_i(options.value || 0),
            data: encoded,
        };
    }
}
