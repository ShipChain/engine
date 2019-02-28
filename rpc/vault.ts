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

import S3 = require('aws-sdk/clients/s3');

import { Wallet } from '../src/entity/Wallet';
import { LoadVault } from '../src/shipchain/LoadVault';
import { StorageCredential } from '../src/entity/StorageCredential';
import { DriverError } from '../src/storage/StorageDriver';

import { RPCMethod, RPCNamespace } from './decorators';
import { validateShipmentArgs } from './validators';

@RPCNamespace({ name: 'Vault' })
export class RPCVault {
    @RPCMethod({
        require: ['storageCredentials', 'shipperWallet'],
        validate: {
            uuid: ['storageCredentials', 'shipperWallet', 'carrierWallet'],
        },
    })
    public static async CreateVault(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const shipperWallet = await Wallet.getById(args.shipperWallet);

        const vault = new LoadVault(storage);
        await vault.getOrCreateMetadata(shipperWallet);

        if (args.carrierWallet) {
            const carrierWallet = await Wallet.getById(args.carrierWallet);
            await vault.authorize(shipperWallet, LoadVault.OWNERS_ROLE, carrierWallet.public_key);
        }

        const signature = await vault.writeMetadata(shipperWallet);

        return {
            success: true,
            vault_id: vault.id,
            vault_signed: signature,
            vault_uri: vault.getVaultMetaFileUri(),
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getTrackingData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            contents: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'payload'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            object: ['payload'],
        },
    })
    public static async AddTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.addTrackingData(wallet, args.payload);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async GetShipmentData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getShipmentData(wallet);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            shipment: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'shipment'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            object: ['shipment'],
        },
    })
    public static async AddShipmentData(args) {
        validateShipmentArgs(args.shipment);

        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.addShipmentData(wallet, args.shipment);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['documentName'],
        },
    })
    public static async GetDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getDocument(wallet, args.documentName);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            document: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'documentContent'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            string: ['documentName', 'documentContent'],
        },
    })
    public static async AddDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.addDocument(wallet, args.documentName, args.documentContent);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'key', 'bucket'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async AddDocumentFromS3(args) {
        const documentContent = await RPCVault.getFileFromS3(args.bucket, args.key);

        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        await load.addDocument(wallet, args.documentName, documentContent);
        const signature = await load.writeMetadata(wallet);

        return {
            success: true,
            vault_signed: signature,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'documentName', 'key', 'bucket'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
        },
    })
    public static async PutDocumentInS3(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);

        const dataUriRegex = /^data:([^;]+);base64,(.*)$/;

        const contents = await load.getDocument(wallet, args.documentName);
        const dataUriMatch = contents.match(dataUriRegex);

        if (dataUriMatch.length == 3) {
            const base64DecodedContents = Buffer.from(dataUriMatch[2], 'base64');
            await RPCVault.putFileInS3(args.bucket, args.key, base64DecodedContents, dataUriMatch[1]);
        } else {
            await RPCVault.putFileInS3(args.bucket, args.key, contents);
        }

        return {
            success: true,
        };
    }

    static async getFileFromS3(bucket: string, objectKey: string): Promise<string> {
        let s3_options = { apiVersion: '2006-03-01' };
        const s3 = new S3(s3_options);

        return new Promise<string>((resolve, reject) => {
            s3.getObject(
                {
                    Key: objectKey,
                    Bucket: bucket,
                },
                (err, data) => {
                    if (err) {
                        reject(new DriverError('S3 Read File', DriverError.States.NotFoundError, err));
                    } else {
                        let document;

                        // Ignore the error for providing a parameter to `toString`.  This is valid for the Buffer type.
                        //@ts-ignore
                        const base64 = data.Body.toString('base64');

                        if (data.ContentType) {
                            document = `data:${data.ContentType};base64,${base64}`;
                        } else {
                            document = `data:application/octet-stream;base64,${base64}`;
                        }

                        resolve(document);
                    }
                },
            );
        });
    }

    static async putFileInS3(
        bucket: string,
        objectKey: string,
        data: any,
        contentType: string = 'application/octet-stream',
    ): Promise<string> {
        let s3_options = { apiVersion: '2006-03-01' };
        const s3 = new S3(s3_options);

        return new Promise<string>((resolve, reject) => {
            s3.upload(
                {
                    Key: objectKey,
                    Body: data,
                    ACL: 'private',
                    Bucket: bucket,
                    ContentType: contentType,
                },
                (err, data) => {
                    if (err) {
                        reject(new DriverError('Write File to s3', DriverError.States.NotFoundError, err));
                    } else {
                        resolve();
                    }
                },
            );
        });
    }

    @RPCMethod({
        require: ['storageCredentials', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vault'],
        },
    })
    public static async ListDocuments(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);

        const load = new LoadVault(storage, args.vault);

        const list = await load.listDocuments();

        return {
            success: true,
            documents: list,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vault'],
        validate: {
            uuid: ['storageCredentials', 'vault'],
        },
    })
    public static async VerifyVault(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);

        const load = new LoadVault(storage, args.vault);

        const verified = await load.verify();

        return {
            success: true,
            verified: verified,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'date'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            date: ['date'],
        },
    })
    public static async GetHistoricalShipmentData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getHistoricalShipment(wallet, args.date);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            historical_data: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'date'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            date: ['date'],
        },
    })
    public static async GetHistoricalTrackingData(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getHistoricalTracking(wallet, args.date);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            historical_data: contents,
        };
    }

    @RPCMethod({
        require: ['storageCredentials', 'vaultWallet', 'vault', 'date'],
        validate: {
            uuid: ['storageCredentials', 'vaultWallet', 'vault'],
            date: ['date'],
        },
    })
    public static async GetHistoricalDocument(args) {
        const storage = await StorageCredential.getOptionsById(args.storageCredentials);
        const wallet = await Wallet.getById(args.vaultWallet);

        const load = new LoadVault(storage, args.vault);
        const contents = await load.getHistoricalDocument(wallet, args.date, args.documentName);

        return {
            success: true,
            wallet_id: wallet.id,
            load_id: args.vault,
            historical_data: contents,
        };
    }
}
