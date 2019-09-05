import { Wallet } from '../../../../entity/Wallet';
import { BaseContract } from '../../../../contracts/BaseContract';

export class VaultNotaryContract extends BaseContract {
    constructor(network: string, version: string) {
        super('VaultNotary', network, version);
    }

    protected static convertShipmentUuidToBytes16(shipmentUuid: string): string {
        return '0x' + shipmentUuid.replace(/-/g, '');
    }

    async registerVaultTx(senderWallet: Wallet, vaultId: number, vaultUri: string, vaultHash: string) {
        return await this.buildTransactionForWallet(senderWallet, 'registerVault', [vaultId, vaultUri, vaultHash]);
    }

    // Uri/Hash Update Methods
    // =====================

    async setVaultUriTx(senderWallet: Wallet, vaultId: string, vaultUri: string) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultUri', [
            VaultNotaryContract.convertShipmentUuidToBytes16(vaultId),
            vaultUri,
        ]);
    }

    async setVaultHashTx(senderWallet: Wallet, vaultId: string, vaultHash: string) {
        return await this.buildTransactionForWallet(senderWallet, 'setVaultHash', [
            VaultNotaryContract.convertShipmentUuidToBytes16(vaultId),
            vaultHash,
        ]);
    }

    // ACL methods
    // =====================
    async grantUpdateHashPermissionTx(senderWallet: Wallet, vaultId: number, addressToGrant: string) {
        return await this.buildTransactionForWallet(senderWallet, 'grantUpdateHashPermission', [
            vaultId,
            addressToGrant,
        ]);
    }
}
