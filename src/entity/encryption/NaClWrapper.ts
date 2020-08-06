import sodium from 'libsodium-wrappers';
import { TextDecoder, TextEncoder } from 'util';

export const X25519_XSALSA20_POLY1305_VERSION = 'x25519-xsalsa20-poly1305';

export interface NaclEncryptedData {
    version: string;
    nonce: string;
    ephemPublicKey: string;
    ciphertext: string;
}

export async function getEncryptionPublicKey(privateKey: string): Promise<string> {
    await sodium.ready;
    const privateKeyUint8Array = hexToUint8Array(privateKey);
    const encryptionPublicKey = sodium.crypto_scalarmult_base(privateKeyUint8Array);
    return uint8ArrayToBase64(encryptionPublicKey);
}

export async function naclEncrypt(
    receiverPublicKey: string,
    msgParams: { data: string },
    version: string,
): Promise<NaclEncryptedData> {
    await sodium.ready;

    switch (version) {
        case X25519_XSALSA20_POLY1305_VERSION: {
            if (typeof msgParams.data !== 'string') {
                throw new Error(
                    'Cannot detect secret message, message params should be of the form {data: "secret message"} ',
                );
            }
            // generate ephemeral keypair
            const ephemeralKeyPair = sodium.crypto_box_keypair();

            // assemble encryption parameters - from string to UInt8
            let pubKeyUInt8Array;
            try {
                pubKeyUInt8Array = base64toUint8Array(receiverPublicKey);
            } catch (err) {
                throw new Error('Bad public key');
            }

            const msgParamsUInt8Array = utf8ToUint8Array(msgParams.data);
            const nonce: Buffer = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

            // encrypt
            const encryptedMessage = sodium.crypto_box_easy(
                msgParamsUInt8Array,
                nonce,
                pubKeyUInt8Array,
                ephemeralKeyPair.privateKey,
            );

            // return encrypted data
            return {
                version: X25519_XSALSA20_POLY1305_VERSION,
                nonce: uint8ArrayToBase64(nonce),
                ephemPublicKey: uint8ArrayToBase64(ephemeralKeyPair.publicKey),
                ciphertext: uint8ArrayToBase64(encryptedMessage),
            };
        }

        default:
            throw new Error('Encryption type/version not supported');
    }
}

export async function naclDecrypt(encryptedData: NaclEncryptedData, receiverPrivateKey: string): Promise<string> {
    await sodium.ready;

    switch (encryptedData.version) {
        case X25519_XSALSA20_POLY1305_VERSION: {
            // string to buffer to UInt8Array
            const receiverPrivateKeyUint8Array = hexToUint8Array(receiverPrivateKey);

            // assemble decryption parameters
            const nonce = base64toUint8Array(encryptedData.nonce);
            const ciphertext = base64toUint8Array(encryptedData.ciphertext);
            const ephemPublicKey = base64toUint8Array(encryptedData.ephemPublicKey);

            // decrypt
            const decryptedMessage = sodium.crypto_box_open_easy(
                ciphertext,
                nonce,
                ephemPublicKey,
                receiverPrivateKeyUint8Array,
            );

            // return decrypted msg data
            let output;
            try {
                output = uint8ArrayToUtf8(decryptedMessage);
            } catch (err) {
                throw new Error('Decryption failed.');
            }

            if (output) {
                return output;
            }
            throw new Error('Decryption failed.');
        }

        default:
            throw new Error('Encryption type/version not supported.');
    }
}

// Encoding/Decoding helper methods
// ================================

function hexToUint8Array(msgHex: string): Uint8Array {
    const msgBase64 = Buffer.from(msgHex, 'hex').toString('base64');
    return base64toUint8Array(msgBase64);
}

function base64toUint8Array(message: string): Uint8Array {
    return new Uint8Array(Array.prototype.slice.call(Buffer.from(message, 'base64'), 0));
}

function uint8ArrayToBase64(array: Uint8Array): string {
    return Buffer.from(array).toString('base64');
}

function utf8ToUint8Array(message: string): Uint8Array {
    return new TextEncoder().encode(message);
}

function uint8ArrayToUtf8(array: Uint8Array): string {
    return new TextDecoder().decode(array);
}
