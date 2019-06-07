import { Logger } from '../../Logger';

const logger = Logger.get(module.filename);
export abstract class DBFieldEncryption {
    protected constructor() {
        logger.info(`Initializing DB Encryptor ${this.constructor.name}`);
    }

    abstract async encrypt(private_key: string): Promise<string>;
    abstract async decrypt(cipher_text: string): Promise<string>;
}
