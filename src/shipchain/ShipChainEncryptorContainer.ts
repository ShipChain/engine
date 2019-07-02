import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from './AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';
const config = require('config');

export class ShipChainEncryptorContainer extends EncryptorContainer {
    static async init() {
        if (config.get('IS_DEPLOYED_STAGE')) {
            EncryptorContainer._defaultEncryptor = await AwsPrivateKeyDBFieldEncryption.getInstance();
        } else {
            EncryptorContainer._defaultEncryptor = await PrivateKeyDBFieldEncryption.getInstance();
        }
    }
}
