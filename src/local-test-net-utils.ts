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

import { Network, Version } from './entity/Contract';
import { Wallet } from './entity/Wallet';
import { Logger } from './Logger';

const logger = Logger.get(module.filename);
const ETH = 10 ** 18;

class LatestContractFormat {
    ShipToken: string;
    LOAD: string;
}

export async function setupLocalTestNetContracts(latest: LatestContractFormat, wallets: Wallet[] = []) {
    const token_version: Version = await Version.getByProjectAndTitle('ShipToken', latest.ShipToken);
    const load_version: Version = await Version.getByProjectAndTitle('LOAD', latest.LOAD);

    if (!token_version) {
        throw new Error('ShipToken Version cannot be found');
    }
    if (!load_version) {
        throw new Error('LOAD Version cannot be found');
    }

    const local_token = await token_version.deployToLocalTestNet();
    const local_load = await load_version.deployToLocalTestNet();

    const token_driver = await local_token['getDriver']();
    const load_driver = await local_load['getDriver']();

    const accounts = await Network.getLocalTestNetAccounts();
    const network = await Network.getLocalTestNet();

    const web3 = local_token['network'].getDriver();

    await new Promise(async (resolve, reject) => {
        load_driver.methods
            .setShipTokenContractAddress(local_token['address'])
            .send({ from: accounts[0] })
            .on('receipt', resolve)
            .on('error', resolve); // if it's already been set, ignore the revert
    });

    for (let wallet of wallets) {
        /* Keep Owner wallet happy */
        let current_balance = await web3.eth.getBalance(wallet.address);

        if (web3.utils.toBN(current_balance).cmp(web3.utils.toBN(2.5 * ETH)) <= 0) {
            logger.info(`${wallet.address} is low on ETH, refilling: ${current_balance}`);
            await new Promise((resolve, reject) =>
                web3.eth
                    .sendTransaction({
                        from: accounts[0],
                        to: wallet.address,
                        value: web3.utils.toBN(5 * ETH).toString(),
                    })
                    .on('receipt', receipt => {
                        resolve();
                    })
                    .on('error', receipt => {
                        reject();
                    }),
            );
        }

        /* and mint 500 ship */
        let current_ship_balance = await local_token['call_static']('balanceOf', [wallet.address]);
        if (web3.utils.toBN(current_ship_balance).cmp(web3.utils.toBN(250 * ETH)) <= 0) {
            logger.info(`${wallet.address} is low on SHIP, refilling: ${current_ship_balance}`);
            await new Promise((resolve, reject) =>
                token_driver.methods
                    .mint(wallet.address, web3.utils.toBN(500 * ETH).toString())
                    .send({ from: accounts[0] })
                    .on('receipt', resolve)
                    .on('error', reject),
            );
        }

        current_balance = await web3.eth.getBalance(wallet.address);
        current_balance = web3.utils.fromWei(current_balance, 'ether');

        current_ship_balance = web3.utils.toBN(await local_token['call_static']('balanceOf', [wallet.address]));
        current_ship_balance = web3.utils.fromWei(current_ship_balance, 'ether');

        logger.info(`${wallet.address} ETH  Balance: ${current_balance}`);
        logger.info(`${wallet.address} SHIP  Balance: ${current_ship_balance}`);
    }

    return {
        web3: web3,
        network: network,
        ShipToken: local_token,
        LOAD: local_load,
    };
}
