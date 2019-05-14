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

import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn, BaseEntity, getConnection } from 'typeorm';
import { Logger } from '../Logger';
import { EncryptorContainer } from './encryption/EncryptorContainer';

const logger = Logger.get(module.filename);

class StorageCredentialAttrs {
    title: string;
    driver_type: string;
    base_path?: string;
    options?: Object;
}

@Entity()
export class StorageCredential extends BaseEntity {
    @PrimaryGeneratedColumn('uuid') id: string;

    @CreateDateColumn() createdDate: Date;

    @Column({ nullable: true })
    title: string;

    @Column('text') driver_type: string;
    @Column('text') base_path: string;

    @Column('simple-json') options: string;

    static async generate_entity(attrs: StorageCredentialAttrs) {
        const credentials = new StorageCredential();
        credentials.title = attrs.title;
        credentials.driver_type = attrs.driver_type;
        credentials.base_path = attrs.base_path || './';

        //credentials.options = attrs.options || {};
        const optionString: string = JSON.stringify({ jsonOption: attrs.options });
        credentials.options = await EncryptorContainer.defaultEncryptor.encrypt(optionString);
        logger.debug(`Creating ${attrs.driver_type} StorageDriver ${attrs.title}`);
        return credentials;
    }

    static async listAll(): Promise<StorageCredential[]> {
        const DB = getConnection();
        const repository = DB.getRepository(StorageCredential);

        return await repository
            .createQueryBuilder('storageCredential')
            .select([
                'storageCredential.id',
                'storageCredential.title',
                'storageCredential.driver_type',
                'storageCredential.base_path',
            ])
            .getMany();
    }

    static async getCount() {
        const DB = getConnection();
        const repository = DB.getRepository(StorageCredential);

        const count = await repository
            .createQueryBuilder('storageCredential')
            .select('COUNT(storageCredential.id) AS cnt')
            .getRawMany();

        return count[0]['cnt'];
    }

    static async getById(id: string) {
        const DB = getConnection();
        const repository = DB.getRepository(StorageCredential);

        let storageCredential = await repository.findOne({ id: id });

        if (!storageCredential) {
            throw new Error('StorageCredentials not found');
        }

        return storageCredential;
    }

    static async getOptionsById(id: string) {
        return (await StorageCredential.getById(id)).getDriverOptions();
    }

    async update(title?: string, options?: any) {
        if (title) {
            this.title = title;
        }

        if (options) {
            const optionString: string = JSON.stringify({ jsonOption: options });
            this.options = await EncryptorContainer.defaultEncryptor.encrypt(optionString);
        }

        await this.save();
    }

    async getDriverOptions() {
        const decrptedOptionString = await EncryptorContainer.defaultEncryptor.decrypt(this.options);
        const wrappedOptions = JSON.parse(decrptedOptionString);
        const decrptedOptions = wrappedOptions['jsonOption'];
        return {
            ...decrptedOptions,
            driver_type: this.driver_type,
            base_path: this.base_path,
            __id: this.id,
        };
    }
}
