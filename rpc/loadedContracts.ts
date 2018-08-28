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

import { BaseContract } from "../src/contracts/BaseContract";
import { Logger, loggers } from "winston";

// @ts-ignore
const logger: Logger = loggers.get('engine');


export class LoadedContracts {
    private static _instance: LoadedContracts;

    private contracts: any;

    private constructor(){
        this.contracts = {};
    }

    public static get Instance(): LoadedContracts {
        return this._instance || (this._instance = new this());
    }

    public loadedContract(project: string, contract: BaseContract, latest: boolean = false) {
        const version = contract.getContractVersion();

        if(!this.contracts.hasOwnProperty(project)) {
            this.contracts[project] = {};
        }

        if(this.contracts[project].hasOwnProperty(version)) {
            const message = `Contract '${project}' version '${version}' already loaded`;
            logger.error(message);
            throw new Error(message);
        }

        this.contracts[project][version] = {
            latest: latest,
            contract: contract,
        };
    }

    public getContract(project: string, version?: string): BaseContract {
        if(!this.contracts.hasOwnProperty(project)) {
            throw new Error(`Contract '${project}' not loaded`)
        }

        if(version === null || version === undefined) {

            for(let loadedVersion in this.contracts[project]){
                if(this.contracts[project].hasOwnProperty(loadedVersion)) {
                    if (this.contracts[project][loadedVersion].latest) {
                        return this.contracts[project][loadedVersion].contract;
                    }
                }
            }

            const message = `Contract '${project}' has no latest version specified`;
            logger.error(message);
            throw new Error(message);
        }

        else {

            if(!this.contracts[project].hasOwnProperty(version)) {
                const message = `Contract '${project}' version '${version}' not loaded`;
                logger.error(message);
                throw new Error(message);
            }

            return this.contracts[project][version].contract;
        }
    }
}
