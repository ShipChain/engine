<p align="center">
  <img src="https://shipchain.io/img/logo.png" alt="ShipChain"/>
</p>

[![CircleCI](https://img.shields.io/circleci/project/github/ShipChain/engine/master.svg)](https://circleci.com/gh/ShipChain/engine/tree/master)
[![License](http://img.shields.io/:license-apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=svg)](https://github.com/prettier/prettier)
[![Chat](https://img.shields.io/badge/gitter-ShipChain/lobby-green.svg)](https://gitter.im/ShipChain/Lobby)

# ShipChain Engine Project
An RPC server that exposes our Typescript abstraction layer on top of Web3 bindings for ShipChain's 
Ethereum smart contracts.

## Getting Started

These instructions will get a copy of Engine up and running in your local environment.

### Security Note

As Engine is only designed to expose ShipChain's smart contracts, it does not include User
management, Authentication, or retry mechanisms for failed transactions. ShipChain's own internal
Engine instance is deployed in conjunction with the
[Transmission](https://github.com/ShipChain/transmission) project to handle Shipment management,
failed transaction retry, message authentication, and uses our own *Profiles* service for
interfacing with a user management system and role-based access controls to wallets and security
credentials.

**Engine RPC should _never_ be exposed to public traffic**.

Engine enables any authorized client to send management commands to any wallet, including
transferring funds, signing of messages on a user's behalf, or deleting access to any wallet. Engine
RPC is designed to run as an internal service, under maximum internal security. It should live
behind it's own strict firewall and only accept traffic from trusted application hosts - We also
provide an nginx configuration that you can use to encrypt the engine traffic over your internal
network. The database you chose to save engine data should be behind it's own firewall and only
accept connections from Engine directly. While the private keys are encrypted-at-rest in the
database, full disk encryption is suggested for further security. In the future, we'll add support
for using a Hardware Security Module (like YubiHSM) for encrypting private keys in the database
(currently, we use AWS secrets management in our production deployments).

### Prerequisites

We developed Engine using an array of Docker containers. Deployment of these containers is handled
through the use of Docker Compose with the provided files in the `compose` directory.

See the official Docker documentation for installation information:

 - [Install Docker](https://docs.docker.com/engine/installation/) version > 17.09.0
 - [Install Docker Compose](https://docs.docker.com/compose/install/) version > 1.21.0

Once Docker is installed, you will need a Docker "network" named `portal`:

```
docker network create portal
```

You will also need to create a new directory tree `/data/shipchain/engine/postgresql` to persist
your local database.

Note: Depending on OS settings, some users may encounter permission errors when running Engine. This
is commonly due to missing
[Shared Drives](https://docs.docker.com/docker-for-windows/#shared-drives) on Windows or
[File Sharing](https://docs.docker.com/docker-for-mac/#file-sharing) on Mac. Be sure these are setup
to allow access to the `/data` directory you created.

#### Windows 10 Users

It is **strongly encouraged** that you utilize Windows Subsystem for Linux (WSL) when using Docker
for Windows. Without this you are very likely to encounter issues with volume mapping permissions in
later steps.

##### Install WSL

Follow Microsoft's procedures for installing
[Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10). We
recommend using [Ubuntu](https://www.microsoft.com/en-us/p/ubuntu/9nblggh4msv6) as your Linux
distribution.

##### Configure WSL with Docker for Windows

Nick Janetakis has a
[fantastic article](https://nickjanetakis.com/blog/setting-up-docker-for-windows-and-wsl-to-work-flawlessly)
on the steps required to get Docker for Windows and WSL working flawlessly. Pay special attention to
the Ensure Volume Mounts Work step. Without that your images will not properly build.

##### Appropriate Directories

After following the steps above, in the Ubuntu Bash prompt you should be able to see the your
Windows drives mounted at the root level.

```
/c
/c/Users
/d
```

After cloning the repo (in the below [Installing](#installing) step, you will need to navigate to
the appropriate directory in your Windows mount where you clone the Engine repository prior to
executing any of the `bin/` commands.

### Installing

Clone the repository:

```
git clone https://github.com/ShipChain/engine.git shipchain-engine
```

In the cloned repository there are scripts provided in the `bin` directory for Docker container
management. Using these to interact with yarn will ensure you are using the correct version of
Node.js (This was developed using LTS v10.14.0).

Install the required Node packages locally, using the build-tools from the docker image. The first
time you run this command it will build the prerequisite docker images for local Engine development.
These images will contain the startup scripts as well as tools required for compiling node packages
during installation.

```
bin/ddo yarn
```

### Scripts

The scripts provided in the `bin` directory allow for easier interaction with the Docker compose
services and containers. All scripts use `base-services.yml` as a baseline for service definitions
and are extended by override files. By default, the override used is the `dev-lite.yml` compose
file. This can be changed to any configuration file by setting the `ROLE` environment variable. For
example if you want to override `base-services.yml` with settings from `my_settings.yml`, you would
only need to set `ROLE=my_settings` in your environment.

 - `bin/dc` Shorthand for running `docker-compose -p shipchain-engine -f compose/base-services.yml
   -f compose/dev-lite.yml $*`. Use this script when you need to build the Engine container or bring
   the stack up and down.
 - `bin/ddo` Run a command _inside_ the Engine RPC container. This is useful for `yarn` or running
   unit tests (described below).
 - `bin/dcleanup` Single command to kill, remove, restart, and tail the new logs of a container.
 - `bin/docker_tests` This executes the unit tests with the `circleci.yml` configuration file. The
   RPC service is launched using `sleep infinity` to prevent the full server from launching for the
   tests.

Local development (with `dev` or `dev-lite` roles) use the `base` stage present in the
[Dockerfile](Dockerfile); please note, this file *doesn't* use the docker `COPY` directive to copy
the project code into the container, instead the code is mounted as a volume (so that as you save
files, they update inside the container).

A deployed environment should use the `prod` or `deploy` stage in the Dockerfile. These will install
node modules passing the `--production` flag to Yarn. Additionally, the `deploy` stage includes
prerequisites for connecting to a separate management container when running in an AWS environment.

### Configuration

Before you can begin using Engine, you may need to do some configuration depending on your specific
requirements.

#### Smart Contracts

When the main Engine RPC server starts, it will download the latest version of ShipChain's smart
contract metadata from a [public URL](https://s3.amazonaws.com/shipchain-contracts/meta.json). This
metadata contains the deployed contract addresses for public Ethereum networks as well as the ABI
and compiled binary data. All relevant information will be parsed and loaded in to Engine's included
Postgres database for later use. There should be no further steps if you are using ShipChain's smart
contracts.

#### Environment Variables

When utilizing the provided scripts in the `bin` directory to manage the Docker containers, a file
in the base folder named `.env` is sourced. This allows you to inject environment variables in to
the launched containers. You will need to create this file in your local environment.

##### Database
 The Docker Compose files provided include a PostgreSQL container that is linked to Engine with
 default connection string `psql://engine:engine@psql:5432/engine`. This can be modified by setting
 the environment variable to your preferred database:

- `DATABASE_URL`

Your database needs to provide a UUID generation library. For PostgreSQL, this can be the
`uuid-ossp` extension.

##### Deployed Environment

The environment that Engine is deployed to changes certain aspects of how Engine runs. For example,
when run in a development environment we do not want to use Ethereum Mainnet and instead would
prefer to use a local test network backed by a GETH POA node. When deployed to a Staging or Testing
environment, we may want to use an Ethereum Test network like Ropsten. This is controlled by setting
the following variable:
 - `ENV`
   - `DEV` uses a local GETH Node included in the Docker stack
   - `STAGE` uses Ropsten
   - `DEMO` uses Rinkeby
   - `PROD` uses Mainnet

##### AWS

If you intend to utilize any AWS services (such as Secrets Manager, RDS, or S3) you may want to
include the following variables to provide a default account.
 - `AWS_ACCESS_KEY_ID`
 - `AWS_SECRET_ACCESS_KEY`

##### Logging

Engine utilizes Winston for log handling. By default all messages that are `INFO` or higher are
logged to the console. You can change the logging level by setting the environment variable:

 - `LOGGING_LEVEL`
    - Valid values: `error`, `warn`, `info`, `verbose`, `debug`, `silly`.  Default is `info`

If you want to also log messages to ElasticSearch, add the following variable pointing to your
logging server (This is currently only used when `ENV` is set to `DEV`, `STAGE`, `DEMO`, or `PROD`)
 - `ELASTICSEARCH_URL`
 - `ELASTICSEARCH_LEVEL`
    - Defaults to the value set in `LOGGING_LEVEL`

Log messages will be sent automatically to AWS CloudWatch when `ENV` is set to `DEV`, `STAGE`,
`DEMO`, or `PROD`). The log level of the messages send to CloudWatch can be controlled via:
 - `CLOUDWATCH_LEVEL`
    - Defaults to the value set in `LOGGING_LEVEL`

##### Metrics
Engine supports the reporting of application metrics to an InfluxDB instance. We use this internally
in combination with Grafana to make a real-time dashboard of our application use. In order to use
this, set:
 - `INFLUXDB_URL` - With the format `http://{host}:{port}/{database}`
 
##### Redis Locking
Engine supports the locking of vaults using redis with default connection string
`redis://:redis_pass@redis_db:6379/1`. We use this when interating with vaults to ensure that
changes don't overlap. In order to use this, set:
 - `REDIS_URL` - With the format `redis://[:password@]host[:port][/db-number][?option=value]`

##### Private Key Encryption
Engine encrypts the Wallet `private_key` fields utilizing the EthCrypto library with a Master
Private Key. That Master private key is pulled from AWS Secrets Manager in a deployed environment,
but in a local development environment, you are required to specify your own by setting:
 - `LOCAL_SECRET_KEY` - This needs to be a properly formatted Ethereum private key (beginning with
   `0x`). The default value if none is specified is
   `0x0000000000000000000000000000000000000000000000000000000000000001`

### Using Configuration Files

Inside the config folder, there are ts configuration files that are named either
"default.ts" or "STAGE_NAME.ts". All the default configuration values should go
into the default.ts. The specific stages will inherit the values of entries from default.ts
by default, while overwriting them if some entries re-defined in a specific STAGE_NAME.ts.

Besides the above, you can write a local.ts file to overwrite any configuration
for your local run, which will overwrite  However, DO NOT add the local.ts to
the git repository. 

For more details of the precedence of different configuration options, you can
refer to [File Load Order](https://github.com/lorenwest/node-config/wiki/Configuration-Files#file-load-order)
and [Command Line Overrides](https://github.com/lorenwest/node-config/wiki/Command-Line-Overrides)

Some rules of the current configuration setting:

Some optional configurations are commented out in the ts files, for example the 
"ES_TEST_NODE_URL". Some other optional entires include,

* INFLUXDB_URL
* ELASTICSEARCH_URL
* ES_TEST_NODE_URL
* GETH_NETWORK

You need to define GETH_NODE in your local.ts. 

## Running the tests

Testing is handled through the Docker containers as well and can be invoked via the
`bin/docker_tests` script. This is the recommended way to run the tests.

### Unit Tests

By default the unit tests will use only the local directory for Storage Driver testing (used when
managing Vaults). However, advanced parameters are allowed which will enable either SFTP backed or
S3 backed Storage Driver testing.

In the `.env` file, include the following to enable SFTP tests using the bundled SFTP service in the
Docker Compose file: `SFTP_DRIVER_TESTS=1`.

In the `.env` file, include the following to enable S3 tests using the bundled
[Minio](https://www.minio.io/docker.html) S3 compatible service in the Docker Compose file:
`S3_DRIVER_TESTS=1`.

Run the unit tests via the provided script
```
bin/docker_tests
```

Generated reports (Jest and Coverage) will be copied locally to a new `reports` directory after the
successful completion of unit tests.

## Launching Engine

To start Engine, use the provided script to bring the stack online:

```
bin/dc up rpc
```

When you see the following line in the output, Engine is now listening for connections via
`http://localhost:2000/`!

```
info: RPC server listening on 2000
```

## Using Engine

As the smart contract methods are exposed via RPC, all requests should be made to the above URL as a
POST using data following the [JSON RPC spec](https://www.jsonrpc.org/specification) for the request
body.

When calling an RPC method, the name of the method is provided as a string in place of
`<rpc_method_name>` and the parameters to the method are provided _as an object_ in place of
`<parameters>`.

```JSON
{
  "method": "<rpc_method_name>",
  "params": {<parameters>},
  "jsonrpc": "2.0",
  "id": 0
}
```

For example, the POST body for calling `sample_method` with 3 parameters: `param1`: `1`, `param2`:
`"string"`, `param3`: `{"property": "value"}` would look like this:

```JSON
{
  "method": "sample_method",
  "params": {"param1": 1, "param2": "string", "param3": {"property": "value"}},
  "jsonrpc": "2.0",
  "id": 0
}
```

Requests that are executed successfully will return an object that follows this structure:

```JSON
{
    "jsonrpc": "2.0",
    "result": {
        "success": true,
        ...
    },
    "id": 0
}
```

Requests that generate an error during execution will return an object that follows this structure:

```JSON
{
    "jsonrpc": "2.0",
    "error": {
        "code": ...,
        "message": "..."
    },
    "id": 0
}
```

### Autogenerated Help

Engine RPC methods are now auto-documented in a special `help` method. The return from this request
will list all available RPC methods and any required/validated fields.

This will return _all_ methods available:

```JSON
{
  "method": "help",
  "params": {},
  "jsonrpc": "2.0",
  "id": 0
}
```

The results can also be scoped down to a specific namespace:

```JSON
{
  "method": "help",
  "params": {
    "namespace": "wallet"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

Giving the result:

```JSON
{
    "jsonrpc": "2.0",
    "result": {
        "wallet": {
            "create_hosted": {},
            "import_hosted": {
                "require": [
                    "privateKey"
                ]
            },
            "list": {},
            "balance": {
                "require": [
                    "wallet"
                ],
                "validate": {
                    "uuid": [
                        "wallet"
                    ]
                }
            }
        }
    },
    "id": 0
}
```

This indicates that there are 4 methods to call in the `wallet` namespace. `create_hosted`,
`import_hosted`, `list`, and `balance`. From this you can also tell that `create_hosted` requires no
parameters and `balance` requires a `wallet` parameter that is a valid UUID.

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

Part of ShipChain's Load Contract is the secured external [Vault](#vaults) for storing any documents
or tracking data related to a shipment. Engine manages the information in these Vaults and will
require credentials to connect to the location where the vault files are stored.

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

### Vaults

Many types of documents and data points need to be tied to a Shipment. However, storing large
amounts of data on the blockchain is prohibitively expensive. To combat the high cost of data
storage while maintaining the guarantee of data integrity for a shipment's related data, Engine has
Vaults.

A Vault is a JSON datastore with embedded, encrypted content held within container sub-objects,
role-based access to those containers, a log of the previous actions, and a signed hash of the full
vault. The vault's hash is generated via the keccak256 hashing algorithm and is stored in the
blockchain to allow 3rd party validation that both the encrypted data within a vault has not been
tampered with and the hash was generated by the owner of that vault (or other Wallet with
appropriate role-based access).

#### Load Vault

See legacy Load Vault documentation in [LOADVAULT.md](LOADVAULT.md)

#### ShipChain Vault

A more flexible vault has been created that supports Primitive data structures. See
[PRIMITIVES.md](PRIMITIVES.md) for details on the Primitive definitions. Ideally, a ShipChainVault
will contain one Primitive and a collection of ShipChainVaults will be utilized for the supply chain
lifecycle (including the Procurement, one or more Shipments, Tracking data, specific Items in a
Shipment, Documents, etc)

##### Create

A vault's location is defined within the context of a Storage Driver. When defining a vault, you
must provide an ID of a [Storage Credential](#storage-credentials) as well as the Owner of the vault

```JSON
{
  "method": "vaults.shipchain.create",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

Optionally, this request accepts a `primitives` parameter for automatically injecting specific
Primitives in to this vault. This should be a list of string names of Primitives. I.E. `["Shipment",
"Tracking"]`

The object returned will include the newly created `vault_id`. This value will need to be provided
as the `vault` parameter to all remaining interactions with the Vault (as seen in the examples
below).

##### Inject

If a desired Primitive was not injected during the initial creation of the ShipChainVault,
additional Primitives can be injected to an existing vault

```JSON
{
  "method": "vaults.shipchain.inject",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "primitives": [
      "Document"
    ]
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

### Load Contract

The Load Contract is versioned using [SemVer](https://semver.org/). The latest supported version in
Engine is `1.1.0`. However, Engine supports interacting with multiple versions of the Load Contract
via different RPC Namespaces.

Every call to interact with a Shipment via the Load Contract will need to provide a ShipmentUUID.
This is currently managed via Transmission for ShipChain's instance of Engine. This UUID will be
transformed in to the byte16 lookup in to the Shipment Mapping in the contract.

NOTE: The methods outlined below are for the latest `1.1.0` version only.

#### Helpful Information

During interaction with ShipChain's Load Contract, you will need to know the following. Additional
information will be available when the contract's source is released.

<!-- TODO: Include link to smart-contracts -->

##### Contract Version

In the response from creating a new Shipment, the Load Contract version is returned
(`contractVersion`). This will be used in interacting with the created shipment through the course
of the shipment's lifetime. Append the `contractVersion` to the RPC Namespace `load` prior to
specifying the RPC Method.

For example, when retrieving Shipment Data for Load Contraction version 1.1.0, instead of calling
`load.get_shipment_data`, you will need to use the contract specific version
`load.1.1.0.get_shipment_data`

```JSON
{
  "method": "load.1.1.0.get_shipment_data",
  "params": {...},
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Multiple Requests Needed

Until this point, most actions in Engine required a single RPC Method invocation. When interacting
with the Smart Contracts you will need to perform _three_ separate requests for most actions. Any
Load RPC method that ends with `_tx` will only generate the _transaction_ for the request. You will
still need to Sign and Send this transaction via the [Transaction](#transactions) RPC Namespace
methods.

##### Escrow Funding Types

When creating a Shipment, you will need to specify the type of Escrow you desire. NO_FUNDING will
prevent funds from being sent to the Escrow for a Shipment. SHIP and ETHER will require the Escrow
to be funded with only SHIP or ETH, respectively.

```JS
export enum EscrowFundingType {
    NO_FUNDING = 0,
    SHIP = 1,
    ETHER = 2,
}
```

##### Shipment States

The state of the Basic Shipment.

```JS
export enum ShipmentState {
    NOT_CREATED = 0,
    CREATED = 1,
    IN_PROGRESS = 2,
    COMPLETE = 3,
    CANCELED = 4,
}
```

##### Escrow States

The state of the Escrow _within_ the Shipment. This is tightly coupled
with the Shipment State. I.E. Funds in an Escrow cannot be distributed
if the Shipment is IN_PROGRESS.

```JS
export enum EscrowState {
    NOT_CREATED = 0,
    CREATED = 1,
    FUNDED = 2,
    RELEASED = 3,
    REFUNDED = 4,
    WITHDRAWN = 5,
}
```

#### Create

Creating a new Shipment is performed via the non-versioned RPC
Namespace. Previous versions of the load contract are not guaranteed to
support creating new Shipments once newer versions are released, but the
non-versioned method will _always_ create shipments against the latest
supported version of the contract.

```JSON
{
  "method": "load.create_shipment_tx",
  "params": {
    "shipmentUuid": "77777777-25fe-465e-8458-0e9f8ffa2cdd",
    "senderWallet": "a245bf61-6669-4d5a-b305-e8a6c39993e7",
    "fundingType": 1,
    "contractedAmount": 1000000000000000000
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

A successful response will follow this structure. Note the `contractVersion` included in the
response. This will be used in generating the `method` names for **all remaining interactions with
this shipment**. The `transaction` object in the response will need to be passed to the
`transaction.sign` method outlined in the [Transactions](#transactions) section

```JSON
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "contractVersion": "1.1.0",
    "transaction": {
      "nonce": "0xc4",
      "chainId": 1337,
      "to": "0xeB6FAce10d2e9ebeEf55f42Cb78834908D5B8a2B",
      "gasPrice": "0x4a817c800",
      "gasLimit": "0x7a120",
      "value": "0x0",
      "data": "0xb5a42b877777777725fe465e84580e9f8ffa2cdd0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a7640000"
    }
  },
  "id": 0
}
```

#### Get Data

There are two types of data stored within the Shipment on the Load Contract.

##### Shipment Data

The basic Shipment data (including the Wallet address of the Shipper, Carrier, and optional
Moderator, as well as the current State of the Shipment).

```JSON
{
  "method": "load.1.1.0.get_shipment_data",
  "params": {
    "shipmentUuid": "77777777-25fe-465e-8458-0e9f8ffa2cdd"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Escrow Data

The Shipment's Escrow data (including the contractedAmount, fundedAmount, createdAt Time,
fundingType, refundAddress, and the current State of the Escrow).

```JSON
{
  "method": "load.1.1.0.get_escrow_data",
  "params": {
    "shipmentUuid": "77777777-25fe-465e-8458-0e9f8ffa2cdd"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### _Documentation in progress..._

```
set_vault_uri_tx
set_vault_hash_tx
set_carrier_tx
set_moderator_tx
set_in_progress_tx
set_complete_tx
set_canceled_tx
fund_escrow_tx
fund_escrow_ether_tx
fund_escrow_ship_tx
release_escrow_tx
withdraw_escrow_tx
refund_escrow_tx
```

### Transactions

After transaction parameters are generated, you will need to sign and send that transaction. Engine
provides methods to handle these operations for you. All Transaction parameter generating methods in
Engine will return objects based on the ethereumjs-tx
[Transaction model](https://github.com/ethereumjs/ethereumjs-tx/blob/master/docs/index.md)

#### Sign

Signing a Transaction requires both an Engine Wallet ID and the Transaction object.

```JSON
{
  "method": "transaction.sign",
  "params": {
    "signerWallet": "92059e4c-0804-4a69-be0b-a86b46f47dc2",
    "txUnsigned": {
      "nonce": "0x1",
      "chainId": 1,
      "to": "0x000000...0001",
      "gasPrice": "0x4a817c800",
      "gasLimit": "0x7a120",
      "value": "0x0",
      "data": "0x2147b6...80000"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Send

The returned, signed Transaction from `transaction.sign` is the only parameter required to send a
transaction to the blockchain.

```JSON
{
  "method": "transaction.send",
  "params": {
    "txSigned": {
      "nonce": "0x01",
      "gasPrice": "0x04a817c800",
      "gasLimit": "0x07a120",
      "to": "0x000000...0001",
      "value": "0x",
      "data": "0x2147b6...80000",
      "v": "0x0a96",
      "r": "0x000000...002142",
      "s": "0x000000...002453"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

The response from this method will be the Transaction Receipt.

### Contract Events

While an Ethereum Smart Contract is being executed zero or more
[Events](https://solidity.readthedocs.io/en/develop/contracts.html?highlight=events#events) may be
emitted asynchronously. Engine provides an Event Subscription service that will listen for events
from a specific contract and POST the request to a registered URL.

There are 2 RPC endpoints for managing these subscriptions.

#### Subscribe

Create an Event Subscription entity in Engine. This accepts a single JSON parameter with 2 required
fields and 3 optional fields that describe the subscription.

```JSONC
{
  "method": "event.subscribe",
  "params": {
    // Required - Endpoint that accepts the Events via a POST
    "url": "http://transmission.local/api/v1/contract/events/",

    // Required - The name of a Contract loaded during Engine configuration
    "project": "LOAD",

    // Optional - Default 30000 (30 seconds)
    "interval": 5000,

    // Optional - Default ["allEvents"] (builtin that returns all events for a contract)
    "eventNames": ["CreateNewShipmentEvent", "DepositETHEvent"]

    // Optional - Default 0 (get every event in the first callback)
    "lastBlock": 100
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

Once an Event Subscription is created it will begin looking for Events after the given interval has
passed. If Engine is restarted, any previously registered Event Subscriptions will restart their
search from the last successful block they sent to the callback URL.

If multiple event names are provided, the callback URL will be called once for each event type with
a list of events matching that type. If only one event name is included then all matching events
will be posted in one request to the callback URL (this is still true when using the "allEvents"
default).

If a request to the callback URL fails for any reason, Engine will retry after the interval timeout.
After 3 failures the Event Subscription paused.

1.  Each time Engine is restarted, any Event Subscriptions in a failed state will have a single
    chance to successfully send a request to the callback URL before being paused again. However, if
    the callback succeeds, the Event Subscription will no longer be in a failure state and will
    continue as normal.
2.  The subscriber may re-subscribe at any point with the same callback URL. This will recreate the
    Event Subscription without being in a failure state.

At any point the subscriber may re-subscribe with the same callback URL and new parameters. This
will recreate the Event Subscription with the new parameters.

#### Unsubscribe

Remove an existing Event Subscription. The Event Subscription will no longer be restarted when
Engine restarts. The only parameters are the specific Project and the URL of an existing
Subscription.

```JSON
{
  "method": "event.unsubscribe",
  "params": {
    "url": "http://transmission.local/api/v1/contract/events/",
    "project": "LOAD"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

## Built With

* [Web3.js](https://web3js.readthedocs.io/en/1.0/index.html) - Ethereum JavaScript API
* [TypeORM](http://typeorm.io/) - ORM / Entity Management

<!--## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details
on our code of conduct, and the process for submitting pull requests to us.

All Typescript source files are run through Prettier to maintain a consistent style. This can be
executed via Docker by running the command

```
bin/ddo yarn run prettier
```
-->

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available,
see the [tags on this repository](https://github.com/shipchain/engine/tags).

## Authors

* **Lucas Clay** - [mlclay](https://github.com/mlclay)
* **Leeward Bound** - [leewardbound](https://github.com/leewardbound)
* **Adam Hodges** - [ajhodges](https://github.com/ajhodges)
* **James Neyer** - [jamesfneyer](https://github.com/jamesfneyer)
* **Jianwei Liu** - [jianwel](https://github.com/jianwel)

<!--See also the list of [contributors](https://github.com/your/project/contributors) who participated-->
<!--in this project.-->

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details

