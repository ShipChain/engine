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

const logger = Logger.get(module.filename);

class LatestContractFormat {
    ShipToken: string;
    LOAD: string;
    NOTARY: string;
}

interface SetupTestNetResponse {
    ShipToken: Contract;
    LOAD: Contract;
    NOTARY: Contract;
}

export async function setupLocalTestNetContracts(
    latest: LatestContractFormat,
    wallets: Wallet[] = [],
): Promise<SetupTestNetResponse> {
    const tokenVersion: Version = await Version.getByProjectAndTitle('ShipToken', latest.ShipToken);
    const loadVersion: Version = await Version.getByProjectAndTitle('LOAD', latest.LOAD);
    const notaryVersion: Version = await Version.getByProjectAndTitle('NOTARY', latest.NOTARY);

    if (!tokenVersion) {
        throw new Error('ShipToken Version cannot be found');
    }
    if (!loadVersion) {
        throw new Error('LOAD Version cannot be found');
    }
    if (!notaryVersion) {
        throw new Error('NOTARY Version cannot be found');
    }

    const tokenContractEntity: Contract = await tokenVersion.deployToLocalTestNet();
    const loadContractEntity: Contract = await loadVersion.deployToLocalTestNet();
    const notaryContractEntity: Contract = await notaryVersion.deployToLocalTestNet();

    const ethereumService: EthereumService = (await Network.getLocalTestNet()).getEthereumService();

    await linkTokenAndLoadContracts(ethereumService, tokenContractEntity, loadContractEntity);

    for (let wallet of wallets) {
        let currentEthBalance = await getAndUpdateEthBalance(ethereumService, wallet);
        let currentShipBalance = await getAndUpdateShipBalance(ethereumService, tokenContractEntity, wallet);

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

async function getAndUpdateEthBalance(ethereumService, wallet) {
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

async function getAndUpdateShipBalance(ethereumService, tokenContractEntity, wallet) {
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
