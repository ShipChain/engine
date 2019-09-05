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
}
