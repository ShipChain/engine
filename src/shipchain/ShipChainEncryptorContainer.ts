import { EncryptorContainer } from '../entity/encryption/EncryptorContainer';
import { AwsPrivateKeyDBFieldEncryption } from '../shipchain/AwsPrivateKeyDBFieldEncryption';
import { PrivateKeyDBFieldEncryption } from '../entity/encryption/PrivateKeyDBFieldEncryption';
const config = require('config');

export class ShipChainEncryptorContainer extends EncryptorContainer {
    static async init() {
        if (config.get("isDeployedStage")) {
            EncryptorContainer._defaultEncryptor = await AwsPrivateKeyDBFieldEncryption.getInstance();
        } else {
            EncryptorContainer._defaultEncryptor = await PrivateKeyDBFieldEncryption.getInstance();
        }
    }
}
