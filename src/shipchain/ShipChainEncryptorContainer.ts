import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from '../shipchain/AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';

export class ShipChainEncryptorContainer extends EncryptorContainer {
    static async init() {
        const ENV = process.env.ENV || 'LOCAL';
        if (ENV === 'DEV' || ENV === 'STAGE' || ENV === 'DEMO' || ENV === 'PROD') {
            EncryptorContainer._defaultEncryptor = await AwsPrivateKeyDBFieldEncryption.getInstance();
        } else {
            EncryptorContainer._defaultEncryptor = await PrivateKeyDBFieldEncryption.getInstance();
        }
    }
}
