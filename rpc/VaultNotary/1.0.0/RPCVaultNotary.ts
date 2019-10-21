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

import { Wallet } from '../../../src/entity/Wallet';
import { RPCMethod, RPCNamespace } from '../../decorators';
import { VaultNotaryContract } from '../../../src/shipchain/contracts/VaultNotary/1.0.0/VaultNotaryContract';
import { LoadedContracts } from '../../contracts';

const loadedContracts = LoadedContracts.Instance;
const PROJECT = 'NOTARY';
const VERSION = '1.0.0';

@RPCNamespace({ name: 'VaultNotary.1.0.0' })
export class RPCVaultNotary {
    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'vaultUri', 'vaultHash'],
        validate: {
            uuid: ['vaultId', 'senderWallet'],
        },
    })
    public static async RegisterVaultTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.registerVaultTx(
            senderWallet,
            args.vaultId,
            args.vaultUri,
            args.vaultHash,
        );

        return {
            success: true,
            contractVersion: NOTARY_CONTRACT.getContractVersion(),
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'vaultUri'],
        validate: {
            uuid: ['vaultId', 'senderWallet'],
        },
    })
    public static async SetVaultUriTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.setVaultUriTx(senderWallet, args.vaultId, args.vaultUri);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'vaultHash'],
        validate: {
            uuid: ['vaultId', 'senderWallet'],
        },
    })
    public static async SetVaultHashTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.setVaultHashTx(senderWallet, args.vaultId, args.vaultHash);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'toGrantWallet'],
        validate: {
            uuid: ['vaultId', 'senderWallet', 'toGrantWallet'],
        },
    })
    public static async GrantUpdateUriPermissionTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const toGrantWallet = await Wallet.getById(args.toGrantWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.grantUpdateUriPermissionTx(senderWallet, args.vaultId, toGrantWallet);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'toRevokeWallet'],
        validate: {
            uuid: ['vaultId', 'senderWallet', 'toRevokeWallet'],
        },
    })
    public static async RevokeUpdateUriPermissionTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const toRevokeWallet = await Wallet.getById(args.toRevokeWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.revokeUpdateUriPermissionTx(
            senderWallet,
            args.vaultId,
            toRevokeWallet,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'toGrantWallet'],
        validate: {
            uuid: ['vaultId', 'senderWallet', 'toGrantWallet'],
        },
    })
    public static async GrantUpdateHashPermissionTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const toGrantWallet = await Wallet.getById(args.toGrantWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.grantUpdateHashPermissionTx(senderWallet, args.vaultId, toGrantWallet);

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId', 'senderWallet', 'toRevokeWallet'],
        validate: {
            uuid: ['vaultId', 'senderWallet', 'toRevokeWallet'],
        },
    })
    public static async RevokeUpdateHashPermissionTx(args) {
        const senderWallet = await Wallet.getById(args.senderWallet);
        const toRevokeWallet = await Wallet.getById(args.toRevokeWallet);

        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        const txUnsigned = await NOTARY_CONTRACT.revokeUpdateHashPermissionTx(
            senderWallet,
            args.vaultId,
            toRevokeWallet,
        );

        return {
            success: true,
            transaction: txUnsigned,
        };
    }

    @RPCMethod({
        require: ['vaultId'],
        validate: {
            uuid: ['vaultId'],
        },
    })
    public static async GetVaultNotaryDetails(args) {
        const NOTARY_CONTRACT: VaultNotaryContract = <VaultNotaryContract>loadedContracts.get(PROJECT, VERSION);

        return {
            success: true,
            details: await NOTARY_CONTRACT.getVaultNotaryDetails(args.vaultId),
        };
    }
}
