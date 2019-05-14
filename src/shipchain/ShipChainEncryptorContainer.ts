import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from '../shipchain/AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';

const ENV = process.env.ENV || 'LOCAL';
export class ShipChainEncryptorContainer extends EncryptorContainer {
    static async init() {
        if (ENV === 'DEV' || ENV === 'STAGE' || ENV === 'DEMO' || ENV === 'PROD') {
            this._defaultEncryptor = await AwsPrivateKeyDBFieldEncryption.getInstance();
        } else {
            this._defaultEncryptor = await PrivateKeyDBFieldEncryption.getInstance();
        }
    }
}
