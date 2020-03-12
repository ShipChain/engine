import { Wallet } from '../../../../entity/Wallet';
import { BaseContract } from '../../../../contracts/BaseContract';

export class VaultNotaryContract extends BaseContract {
    constructor(network: string, version: string) {
        super('NOTARY', network, version);
    }

    protected static convertUuidToBytes16(id: string): string {
        return '0x' + id.replace(/-/g, '');
    }

    async registerVaultTx(senderWallet: Wallet, vaultId: string, vaultUri: string, vaultHash: string) {
        return await this.buildTransactionForWallet(senderWallet, 'registerVault', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            vaultUri,
            vaultHash,
        ]);
    }

    // Uri/Hash Update Methods
    // =====================

    async setVaultUriTx(senderWallet: Wallet, vaultId: string, vaultUri: string) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultUri', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            vaultUri,
        ]);
    }

    async setVaultHashTx(senderWallet: Wallet, vaultId: string, vaultHash: string) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultHash', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            vaultHash,
        ]);
    }

    // ACL methods
    // =====================
    async grantUpdateUriPermissionTx(senderWallet: Wallet, vaultId: string, toGrantWallet: Wallet) {
        return await this.buildTransactionForWallet(senderWallet, 'grantUpdateUriPermission', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            await toGrantWallet.asyncEvmAddress,
        ]);
    }

    async revokeUpdateUriPermissionTx(senderWallet: Wallet, vaultId: string, toRevokeWallet: Wallet) {
        return await this.buildTransactionForWallet(senderWallet, 'revokeUpdateUriPermission', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            await toRevokeWallet.asyncEvmAddress,
        ]);
    }

    async grantUpdateHashPermissionTx(senderWallet: Wallet, vaultId: string, toGrantWallet: Wallet) {
        return await this.buildTransactionForWallet(senderWallet, 'grantUpdateHashPermission', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            await toGrantWallet.asyncEvmAddress,
        ]);
    }

    async revokeUpdateHashPermissionTx(senderWallet: Wallet, vaultId: string, toRevokeWallet: Wallet) {
        return await this.buildTransactionForWallet(senderWallet, 'revokeUpdateHashPermission', [
            VaultNotaryContract.convertUuidToBytes16(vaultId),
            await toRevokeWallet.asyncEvmAddress,
        ]);
    }

    //view methods
    // =====================
    async getVaultNotaryDetails(vaultId: string) {
        return await this.callStatic('getVaultNotaryDetails', [VaultNotaryContract.convertUuidToBytes16(vaultId)]);
    }
}
