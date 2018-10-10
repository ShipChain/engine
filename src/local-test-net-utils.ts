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

import { Contract, Network } from './entity/Contract';
import { Wallet } from './entity/Wallet';
import { Logger, loggers } from 'winston';

// @ts-ignore
const logger: Logger = loggers.get('engine');
const ETH = 10 ** 18;

export async function setupLocalTestNetContracts(nodeUrl: string, wallets: Wallet[] = []) {
    const ropsten_token = await Contract.getContractVersion('ShipToken', 'ropsten', '1.0.0');
    const ropsten_load = await Contract.getContractVersion('LOAD', 'ropsten', '1.0.2');

    const local_token = await ropsten_token.version.deployToLocalTestNet(nodeUrl);
    const local_load = await ropsten_load.version.deployToLocalTestNet(nodeUrl);

    const token_driver = await local_token['getDriver']();
    const load_driver = await local_load['getDriver']();

    const accounts = await Network.getLocalTestNetAccounts(nodeUrl);
    const network = await Network.getLocalTestNet(nodeUrl);

    const web3 = local_token['network'].getDriver();

    await new Promise(async (resolve, reject) => {
        let linkedAddress = await load_driver.methods.getTokenContractAddress().call();
        if (linkedAddress == local_token['address']) {
            logger.info('Token Contract Address already set');
            resolve();
        } else {
            load_driver.methods
                .setTokenContractAddress(local_token['address'])
                .send({ from: accounts[0] })
                .on('receipt', resolve)
                .on('error', reject);
        }
    });

    for (let wallet of wallets) {
        /* Keep Owner wallet happy */
        let current_balance = await web3.eth.getBalance(wallet.address);
        if (current_balance <= 2.5 * ETH) {
            logger.info(`${wallet.address} is low on ETH, refilling: ${current_balance}`);
            await new Promise((resolve, reject) =>
                web3.eth
                    .sendTransaction({
                        from: accounts[0],
                        to: wallet.address,
                        value: 5 * ETH,
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
        if (current_ship_balance <= 250 * ETH) {
            logger.info(`${wallet.address} is low on SHIP, refilling: ${current_ship_balance}`);
            await new Promise((resolve, reject) =>
                token_driver.methods
                    .mint(wallet.address, 500 * ETH)
                    .send({ from: accounts[0] })
                    .on('receipt', resolve)
                    .on('error', reject),
            );
        }

        current_balance = (await web3.eth.getBalance(wallet.address)) / ETH;
        current_ship_balance = (await local_token['call_static']('balanceOf', [wallet.address])) / ETH;

        logger.info(`${wallet.address} ETH  Balance: ${current_balance}`);
        logger.info(`${wallet.address} SHIP  Balance: ${current_ship_balance}`);
    }

    return [web3, network, local_token, local_load];
}
