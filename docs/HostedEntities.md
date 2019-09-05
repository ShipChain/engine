## Hosted Entities

When interacting with Engine via RPC, most of the methods invoked will require a reference to some
known entity. Typically a Wallet or a StorageCredential. These are the only user-managed persistent
data objects stored within Engine's RDBMS (Postgres by default).

### Wallet Management

Most Engine requests will require the ID of a Wallet that is hosted within Engine. Engine provides
the ability to generate a new Wallet or you may import one by private key.

#### Create

Engine can generate a Wallet for you, including the public key, private key, and address. No
additional parameters are required.

```JSON
{
  "method": "wallet.create_hosted",
  "params": {},
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Import

You can allowing Engine to safely store information to sign and send transactions with your existing
Wallet. The private key of your wallet is the only parameter.

```JSON
{
  "method": "wallet.import_hosted",
  "params": {
      "privateKey": "0x0000000000000000000000000000000000000000000000000000000000000001"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### List

List the IDs and Addresses of the Wallets hosted in Engine. This does not return the private key of
the Wallets.

```JSON
{
  "method": "wallet.list",
  "params": {},
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Balances

Retrieve the current SHIP Token and Ether balance of a Wallet.

```JSON
{
  "method": "wallet.balance",
  "params": {
      "wallet": "0863ac87-bed7-4dbc-b7d6-01adae523913"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

### Storage Credentials

Part of ShipChain's Load Contract is the secured external [Vaults](../README.md#vaults) for storing
any documents or tracking data related to a shipment. Engine manages the information in these Vaults
and will require credentials to connect to the location where the vault files are stored.

#### Create

Currently Engine supports connection to vaults in Local Storage, S3 Buckets (or S3 compatible), and
SFTP servers. Each of these has a different Storage Driver handling the I/O and slightly different
parameters to creating the Storage Credentials.

These parameters are common to all Storage Credential creations:

 - `driver_type` One of `s3`, `sftp`, or `local`. These may have additional parameters described
   below.
 - `title` Friendly title to remember this connection by.
 - `base_path` Path within the storage driver where the vaults will be created. Defaults to the root
   directory.

##### S3

 - `Bucket` _Required_ Name of the bucket in which you want to store the vaults
 - `acl` Access Control List of the created vaults. Defaults to `public-read` to allow 3rd party
   verification of Vault hashes
 - `client` Additional connection parameters. Any options listed in AWS Javascript SDK documentation
   for an
   [S3 Constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)
   are valid here.

```JSON
{
  "method": "storage_credentials.create_hosted",
  "params": {
    "driver_type": "s3",
    "title": "My S3 Bucket",
    "options": {
        "Bucket": "my-bucket",
        "client": {
          "accessKeyId": "MYACCESSID",
          "secretAccessKey": "MySupERSecREt@Cce55KkeY"
        }
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

During local development, if you do not have or do not wish to use your own AWS S3 Buckets for
storage, you can utilize the provided S3 compatible Minio service as a storage provider, use the
following options:

```JSON
{
    "method": "storage_credentials.create_hosted",
    "params": {
        "title": "Test Minio",
        "driver_type": "s3",
        "options": {
            "Bucket": "test-bucket.mycompany.com",
            "client": {
                "endpoint": "http://minio:9000",
                "accessKeyId": "myMinioAccessKey",
                "secretAccessKey": "myMinioSecretKey",
                "s3ForcePathStyle": true,
                "signatureVersion": "v4"
            }
        }
    },
    "jsonrpc": "2.0",
    "id": 0
}
```

To view the Minio interface to the Buckets containing the vault files, navigate to
[http://localhost:9099](http://localhost:9099) when you have the services running.

##### SFTP

 - `credentials` _Required_ Connection parameters. Any options listed in the SSH2 Documetation for
   the [connect](https://github.com/mscdex/ssh2#client-methods) method are valid here. Most commonly
   this will include:
    - `host`
    - `port`
    - `username`
    - `password`

```JSON
{
  "method": "storage_credentials.create_hosted",
  "params": {
    "driver_type": "sftp",
    "title": "My SFTP Server",
    "base_path": "vaults",
    "options": {
      "credentials": {
        "host": "sftp.example.com",
        "port": "22",
        "username": "rmunroe",
        "password": "Tr0ub4dor&3"
      }
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Validate and Create

Engine also provides the ability to Validate Storage Credential options prior to creating the
entity. This is useful for testing permissions, base path, authentication, etc without needing to
create the entity first and then call a separate rpc method to test. If the connectivity test is
performed successfully, the entity will be created. If the test fails, the entity is not created and
the error response will contain information regarding the failure.

The arguments to this endpoint are identical to those in the `"method":
"storage_credentials.create_hosted"` method. The only difference in invoking this endpoint is the
method name.

```JSON
{
  "method": "storage_credentials.validate_create",
  "params": {
    ...
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### List

List the Title, Driver Type, and Base path of the Storage Credentials hosted in Engine. This does
not return any secrets used in connecting to the backing Storage Driver.

```JSON
{
  "method": "storage_credentials.list",
  "params": {},
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Update

Modify the Title or Options of an existing Storage Credentials hosted in Engine. The `base_path` and
`driver_type` of a saved StorageCredentials can not be updated as that change would likely make
existing Vaults accessed with the StorageCredentials unreachable.

```JSON
{
  "method": "storage_credentials.update",
  "params": {
    "storageCredentials": "7cc34443-64af-4d48-b9f2-0bcdf488f1e3",
    "title": "Optional Updated Title",
    "options": {
      "credentials": {
        "host": "sftp.example.com",
        "port": "22",
        "username": "rmunroe",
        "password": "correcthorsebatterystaple"
      }
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Test

After creating a StorageCredential, you may want to test connectivity prior to utilizing it for
storing Vaults. To do this, use the following method with the ID of the created Storage Credential.

```JSON
{
  "method": "storage_credentials.test",
  "params": {
    "storageCredentials": "7cc34443-64af-4d48-b9f2-0bcdf488f1e3"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

The return from this method will include a `"valid": true` if a files was successfully created with
the storage driver, or `"valid": false` and potentially a `"message": <reason>` indicating what went
wrong.