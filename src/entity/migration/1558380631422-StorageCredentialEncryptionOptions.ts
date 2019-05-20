import {MigrationInterface, QueryRunner, getConnection} from "typeorm";
import { AwsPrivateKeyDBFieldEncryption } from "../../shipchain/AwsPrivateKeyDBFieldEncryption";
import { PrivateKeyDBFieldEncryption } from "../encryption/PrivateKeyDBFieldEncryption";
import { DBFieldEncryption } from "../encryption/DBFieldEncryption";
import { StorageCredential } from "../StorageCredential";

export class StorageCredentialEncryptionOptions1558380631422 implements MigrationInterface {

    private async getEncyptHandler() : Promise<DBFieldEncryption> {
        const ENV = process.env.ENV || 'LOCAL';
        if (ENV === "DEV" || ENV === "STAGE" || ENV === "PROD") {
                return await AwsPrivateKeyDBFieldEncryption.getInstance();
            } else {
                return await PrivateKeyDBFieldEncryption.getInstance();
            }
    }

    public async up(queryRunner: QueryRunner): Promise<any> {
        const connection = getConnection();
        const scOptions = await connection
        .getRepository(StorageCredential)
        .find();
        const encryptor : DBFieldEncryption = await this.getEncyptHandler();
        for (let sco of scOptions) {
            const optionString: string = JSON.stringify(sco.options);
            const encryptString = await encryptor.encrypt(optionString);
            sco.options = {'EncryptedJson' : encryptString};
            sco.save();
        }
    }
    
    public async down(queryRunner: QueryRunner): Promise<any> {
        const connection = getConnection();
        const scOptions = await connection
        .getRepository(StorageCredential)
        .find();
        const encryptor : DBFieldEncryption = await this.getEncyptHandler();
        for (let sco of scOptions) {
            const decrptedOptionString = await encryptor.decrypt(sco.options['EncryptedJson']);
            const decrptedOptions= JSON.parse(decrptedOptionString);
            sco.options = decrptedOptions; 
            sco.save();
        }
    }


}