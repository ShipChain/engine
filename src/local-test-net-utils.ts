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

import { Contract, Version, Network } from './entity/Contract';
import { Wallet } from './entity/Wallet';
import { Logger } from './Logger';
import { EthereumService } from './eth/EthereumService';
import compareVersions from 'compare-versions';

const logger = Logger.get(module.filename);

class DeployContractFormat {
    ShipToken?: string;
    LOAD?: string;
    NOTARY?: string;
}

interface SetupTestNetResponse {
    ShipToken?: Contract;
    LOAD?: Contract;
    NOTARY?: Contract;
}

async function deployContract(project: string, version: string): Promise<Contract> {
    if (!version || version == '') {
        logger.info(`Skipping empty version for ${project}`);
        return null;
    }

    const tokenVersion: Version = await Version.getByProjectAndTitle(project, version);
    if (!tokenVersion) {
        throw new Error(`${project} version ${version} cannot be found`);
    }

    return await tokenVersion.deployToLocalTestNet();
}

async function deployLoadContract(tokenContractEntity: Contract, version: string): Promise<Contract> {
    const loadContractEntity: Contract = await deployContract('LOAD', version);
    const ethereumService: EthereumService = (await Network.getLocalTestNet()).getEthereumService();

    await linkTokenAndLoadContracts(ethereumService, tokenContractEntity, loadContractEntity);

    return loadContractEntity;
}

async function deployOldContracts(tokenContractEntity: Contract, latest: DeployContractFormat, contractMetadata: any) {
    logger.info(`Deploying old contracts prior to ${JSON.stringify(latest)}`);

    for (let oldLoadVersion of Object.keys(contractMetadata.LOAD.versions)) {
        if (compareVersions.compare(oldLoadVersion, latest.LOAD, '<')) {
            await deployLoadContract(tokenContractEntity, oldLoadVersion);
        }
    }

    if (latest.NOTARY) {
        for (let oldNotaryVersion of Object.keys(contractMetadata.NOTARY.versions)) {
            if (compareVersions.compare(oldNotaryVersion, latest.NOTARY, '<')) {
                await deployContract('NOTARY', oldNotaryVersion);
            }
        }
    }
}

export async function setupLocalTestNetContracts(
    latest: DeployContractFormat,
    wallets: Wallet[] = [],
    contractMetadata: any = null,
): Promise<SetupTestNetResponse> {
    const tokenContractEntity: Contract = await deployContract('ShipToken', latest.ShipToken);
    const loadContractEntity: Contract = await deployLoadContract(tokenContractEntity, latest.LOAD);
    const notaryContractEntity: Contract = await deployContract('NOTARY', latest.NOTARY);

    if (contractMetadata) {
        await deployOldContracts(tokenContractEntity, latest, contractMetadata);
    }

    for (let wallet of wallets) {
        let currentEthBalance = await getAndUpdateEthBalance(wallet);
        let currentShipBalance = await getAndUpdateShipBalance(tokenContractEntity, wallet);

        logger.info(`${wallet.address} ETH   Balance: ${currentEthBalance}`);
        logger.info(`${wallet.address} SHIP  Balance: ${currentShipBalance}`);
    }

    return {
        ShipToken: tokenContractEntity,
        LOAD: loadContractEntity,
        NOTARY: notaryContractEntity,
    };
}

async function linkTokenAndLoadContracts(ethereumService, tokenContractEntity, loadContractEntity) {
    const loadContractInstance = await loadContractEntity.getContractInstance();
    try {
        await ethereumService.callContractFromNodeAccount(loadContractInstance, 'setShipTokenContractAddress', [
            tokenContractEntity.address,
        ]);
    } catch (err) {
        logger.debug(`setShipTokenContractAddress already called`);
    }
}

async function getAndUpdateEthBalance(wallet) {
    const ethereumService: EthereumService = (await Network.getLocalTestNet()).getEthereumService();

    // Keep Owner wallet funded with ETH from unlocked deployer
    let currentEthBalance = await ethereumService.getBalance(wallet.address);

    // Depending on the underlying EthereumService implementation this step may or may not be necessary
    currentEthBalance = ethereumService.toBigNumber(currentEthBalance);

    if (currentEthBalance.lt(ethereumService.unitToWei(2.5, 'ether'))) {
        logger.info(`${wallet.address} is low on ETH, refilling: ${currentEthBalance}`);
        await ethereumService.sendWeiFromNodeAccount(wallet.address, ethereumService.unitToWei(5, 'ether'));
    }

    currentEthBalance = await ethereumService.getBalance(wallet.address);
    return ethereumService.weiToUnit(currentEthBalance, 'ether');
}

async function getAndUpdateShipBalance(tokenContractEntity, wallet) {
    const ethereumService: EthereumService = (await Network.getLocalTestNet()).getEthereumService();
    const tokenContractInstance = await tokenContractEntity.getContractInstance();

    let currentShipBalance = await tokenContractEntity.call_static('balanceOf', [wallet.address]);

    // Depending on the underlying EthereumService implementation this step may or may not be necessary
    currentShipBalance = ethereumService.toBigNumber(currentShipBalance);

    if (currentShipBalance.lt(ethereumService.unitToWei(250, 'ether'))) {
        logger.info(`${wallet.address} is low on SHIP, refilling: ${currentShipBalance}`);

        await ethereumService.callContractFromNodeAccount(tokenContractInstance, 'mint', [
            wallet.address,
            ethereumService.unitToWei(500, 'ether').toString(),
        ]);
    }

    currentShipBalance = ethereumService.toBigNumber(
        await tokenContractEntity.call_static('balanceOf', [wallet.address]),
    );
    return ethereumService.weiToUnit(currentShipBalance, 'ether');
}
