<p align="center">
  <img src="https://shipchain.io/img/logo.png" alt="ShipChain"/>
</p>

[![CircleCI](https://circleci.com/gh/ShipChain/engine/tree/master.svg?style=svg)](https://circleci.com/gh/ShipChain/engine/tree/master)
[![License](http://img.shields.io/:license-apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=svg)](https://github.com/prettier/prettier)
[![Chat](https://img.shields.io/badge/gitter-ShipChain/lobby-green.svg)](https://gitter.im/ShipChain/Lobby)

# ShipChain Engine Project
An RPC server that exposes our Typescript abstraction layer on top of Web3 bindings for ShipChain's Ethereum smart contracts.

## Getting Started

These instructions will get a copy of Engine up and running in your local environment.

_NOTE: As Engine is only designed to expose ShipChain's smart contracts, it does not include User management, Authentication, or retry mechanisms for failed transactions.  ShipChain's own Engine is deployed in conjunction with the [Transmission](https://github.com/ShipChain/transmission) project to handle Shipment management, failed transaction retry, message authentication, and interfacing with a user management system._

### Prerequisites

We developed Engine using an array of Docker containers.  Deployment of these containers is handled through the use of Docker Compose with the provided files in the `compose` directory.

See the official Docker documentation for installation information:

 - [Install Docker](https://docs.docker.com/engine/installation/)
 - [Install Docker Compose](https://docs.docker.com/compose/install/) version > 1.21.0

Once Docker is installed, you will need a Docker "network" named `portal`:

```
docker network create portal
```

You will also need to create a new directory tree `/data/shipchain/engine/postgresql` to persist your local database.

Note:  Depending on OS settings, some users may encounter permission errors when running Engine.  This is commonly due to missing [Shared Drives](https://docs.docker.com/docker-for-windows/#shared-drives) on Windows or [File Sharing](https://docs.docker.com/docker-for-mac/#file-sharing) on Mac.  Be sure these are setup to allow access to the `/data` directory you created.

### Installing

Clone the repository:

```
git clone git@github.com:ShipChain/engine.git shipchain-engine
```

In the cloned repository there are scripts provided in the `bin` directory for Docker container management.  Using these to interact with npm will ensure you are using the correct version of Node.js (This was developed using LTS v8.11.2).

Install the required Node packages:

```
bin/ddo npm install
```

Build the Docker image:

```
bin/dc build
```

### Scripts

The scripts provided in the `bin` directory allow for easier interaction with the Docker compose services and containers.  By default, these scripts use the `dev.yml` compose file.  This can be changed to any configuration file by setting the `ROLE` environment variable.  For example if you want to use `my_settings.yml` with the scripts provided, you would only need to set `ROLE=my_settings` in your environment.

 - `bin/dc` Shorthand for running `docker-compose -p shipchain-engine -f compose/dev.yml $*`.  Use this script when you need to build the Engine container or bring the stack up and down.
 - `bin/ddo` Run a command _inside_ the Engine RPC container.  This is useful for `npm install` or running unit tests (described below).
 - `bin/dcleanup` Single command to kill, remove, restart, and tail the new logs of a container.
 - `bin/docker_tests` This executes the unit tests with the `circleci.yml` configuration file.  The RPC service is launched using `sleep infinity` to prevent the full server from launching for the tests.

### Configuration

Before you can begin using Engine, you may need to do some configuration depending on your specific requirements.

#### Smart Contracts

Building the main Engine Node.js Docker service with `bin/dc build` will download the latest version of ShipChain's smart contract compiled binaries.  These are loaded during the initialization stage of the RPC service.  There should be no further steps if you are using ShipChain's smart contracts.

#### Environment Variables

When utilizing the provided scripts in the `bin` directory to manage the Docker containers, a file in the base folder named `.env` is sourced.  This allows you to inject environment variables in to the launched containers.  You will need to create this file in your local environment.

##### Database

The Docker Compose files provided include a PostgreSQL container that is linked to Engine with default connection string `psql://engine:engine@psql:5432/engine`.  This can be modified by setting the environment variable to your preferred database:

- `DATABASE_URL`

Your database needs to provide a UUID generation library.  For PostgreSQL, this can be the `uuid-ossp` extension.

##### Deployed Environment

The environment that Engine is deployed to changes certain aspects of how Engine runs.  For example, when run in a development environment we do not want to use Ethereum Mainnet and instead would prefer to use a local test network backed by a GETH POA node.  When deployed to a Staging or Testing environment, we may want to use an Ethereum Test network like Ropsten.  This is controlled by setting the following variable:
 - `ENV`
   - `DEV` uses a local GETH Node included in the Docker stack
   - `STAGE` uses Ropsten
   - `PROD` uses Mainnet

##### AWS

If you intend to utilize any AWS services (such as Secrets Manager, RDS, or S3) you may want to include the following variables to provide a default account.
 - `AWS_ACCESS_KEY_ID`
 - `AWS_SECRET_ACCESS_KEY`

##### Logging

Engine utilizes Winston for log handling.  By default all messages  that are `INFO` or higher are logged to the console.  You can change the logging level by setting the environment variable:

 - `LOGGING_LEVEL`
 	- Valid values: `error`, `warn`, `info`, `verbose`, `debug`, `silly`.  Default is `info`

If you want to also log messages to ElasticSearch, add the following variable pointing to your logging server (This is currently only used when `ENV` is set to `DEV`, `STAGE`, or `PROD`)
 - `ELASTICSEARCH_URL`
 - `ELASTICSEARCH_LEVEL`
 	- Defaults to the value set in `LOGGING_LEVEL`

## Running the tests

Testing is handled through the Docker containers as well and can be invoked via the `bin/docker_tests` script.  This is the recommended way to run the tests.

### Unit Tests

By default the unit tests will use only the local directory for Storage Driver testing (used when managing Vaults).  However, advanced parameters are allowed which will enable either SFTP backed or S3 backed Storage Driver testing.

In the `.env` file, include the following to enable SFTP tests using the bundled SFTP service in the Docker Compose file: `S3_DRIVER_TESTS=1`.

If you want to test with your personal S3 Bucket, ensure you have the AWS credentials defined in your `.env` file (see Configuration section) and also include the following two variables `S3_DRIVER_TESTS=1` and `S3_BUCKET=<your_bucket>`.

Run the unit tests via the provided script
```
bin/docker_tests
```

## Launching Engine

To start Engine, use the provided script to bring the stack online:

```
bin/dc up
```

When you see the following line in the output, Engine is now listening for connections via `http://localhost:2000/`!

```
info: RPC server listening on 2000
```

## Using Engine

As the smart contract methods are exposed via RPC, all requests should be made to the above URL as a POST using data following the [JSON RPC spec](https://www.jsonrpc.org/specification) for the request body.

When calling an RPC method, the name of the method is provided as a string in place of `<rpc_method_name>` and the parameters to the method are provided _as a list_ in place of `<parameters>`.

```JS
{
  "method": "<rpc_method_name>",
  "params": [<parameters>],
  "jsonrpc": "2.0",
  "id": 0
}
```

For example, the POST body for calling `sample_method` with 3 parameters: `1`, `"string"`, `{"property": "value"}` would look like this:

```JS
{
  "method": "sample_method",
  "params": [1, "string", {"property": "value"}],
  "jsonrpc": "2.0",
  "id": 0
}
```

### Wallet Management

Most Engine requests will require the ID of a Wallet that is hosted within Engine.  Engine provides the ability to generate a new Wallet or you may import one by private key.

#### Create

Engine can generate a Wallet for you, including the public key, private key, and address.  No additional parameters are required.

```JS
{
  "method": "wallet.create_hosted",
  "params": [],
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Import

You can allowing Engine to safely store information to sign and send transactions with your existing Wallet.  The private key of your wallet is the only parameter.

```JS
{
  "method": "wallet.import_hosted",
  "params": ["0x0000000000000000000000000000000000000000000000000000000000000001"],
  "jsonrpc": "2.0",
  "id": 0
}
```

#### List

List the IDs and Addresses of the Wallets hosted in Engine.  This does not return the private key of the Wallets.

```JS
{
  "method": "wallet.list",
  "params": [],
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Balances

Retrieve the current SHIP Token and Ether balance of a Wallet.

```JS
{
  "method": "wallet.balance",
  "params": ["0863ac87-bed7-4dbc-b7d6-01adae523913"],
  "jsonrpc": "2.0",
  "id": 0
}
```

### Storage Credentials

Part of ShipChain's Load Contract is the secured external Vault for storing any documents or tracking data related to a shipment.  Engine manages the information in these Vaults and will require credentials to connect to the location where the vault files are stored.

#### Create

Currently Engine supports connection to vaults in Local Storage, S3 Buckets (or S3 compatible), and SFTP servers.  Each of these has a different Storage Driver handling the I/O and slightly different parameters to creating the Storage Credentials.

These parameters are common to all Storage Credential creations:

 - `driver_type` One of `s3`, `sftp`, or `local`.  These may have additional parameters described below.
 - `title` Friendly title to remeber this connection by.
 - `base_path` Path within the storage driver where the vaults will be created.  Defaults to the root directory.

##### S3

 - `Bucket` _Required_ Name of the bucket in which you want to store the vaults
 - `acl` Access Control List of the created vaults.  Defaults to `public-read` to allow 3rd party verification of Vault hashes
 - `client` Additional connection parameters.  Any options listed in AWS Javascript SDK documentation for an [S3 Constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property) are valid here.

```JS
{
  "method": "storage_credentials.create_hosted",
  "params": [{
    "driver_type": "s3",
    "title": "My S3 Bucket",
    "Bucket": "my-bucket",
    "client": {
      "accessKeyId": "MYACCESSID",
      "secretAccessKey": "MySupERSecREt@Cce55KkeY"
    }
  }],
  "jsonrpc": "2.0",
  "id": 0
}
```

##### SFTP

 - `credentials` _Required_ Connection parameters.  Any options listed in the SSH2 Documetation for the [connect](https://github.com/mscdex/ssh2#client-methods) method are valid here.  Most commonly this will include:
 	- `host`
 	- `port`
 	- `username`
 	- `password`

```JS
{
  "method": "storage_credentials.create_hosted",
  "params": [{
    "driver_type": "sfstp",
    "title": "My SFTP Server",
    "base_path": "vaults",
    "credentials": {
      "host": "sftp.example.com",
      "port": "22",
      "username": "my_user",
      "password": "correcthorsebatterystaple"
    }
  }],
  "jsonrpc": "2.0",
  "id": 0
}
```

#### List

List the Title, Driver Type, and Base path of the Storage Credentials hosted in Engine.  This does not return any secrets used in connecting to the backing Storage Driver.

```JS
{
  "method": "storage_credentials.list",
  "params": [],
  "jsonrpc": "2.0",
  "id": 0
}
```

### Load Contract

_Documentation in progress..._

```
#### Create Shipment
#### Create Vault
#### Manage Tracking Data
##### Add
##### Retrieve
#### Manage Shipment Fields
##### Add
##### Retrieve
#### Update Contract Vault Hash
#### Status
##### Details
##### Details Continued
##### Escrow
##### Flags
#### Funding
##### SHIPToken
##### Ether
##### Cash
#### Carrier Progress
##### Commit
##### In Transit
##### Complete
#### Shipper Accept
#### Carrier Payment
#### Shipper Cancel
```

### Transactions

After transaction parameters are generated, you will need to sign and send that transaction.  Engine provides methods to handle these operations for you.  All Transaction parameter generating methods in Engine will return objects based on the ethereumjs-tx [Transaction model](https://github.com/ethereumjs/ethereumjs-tx/blob/master/docs/index.md)

#### Sign

Signing a Transaction requires both an Engine Wallet ID and the Transaction object.

```
{
  "method": "transaction.sign",
  "params": [
  	"92059e4c-0804-4a69-be0b-a86b46f47dc2",
    {
      "nonce": "0x1",
      "chainId": 1,
      "to": "0x000000...0001",
      "gasPrice": "0x4a817c800",
      "gasLimit": "0x7a120",
      "value": "0x0",
      "data": "0x2147b6...80000"
    }
  ],
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Send

The returned, signed Transaction from `transaction.sign` is the only parameter required to send a transaction to the blockchain.

```
{
  "method": "transaction.send",
  "params": [
  	"92059e4c-0804-4a69-be0b-a86b46f47dc2",
    {
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
  ],
  "jsonrpc": "2.0",
  "id": 0
}
```

The response from this method will be the Transaction Receipt.

### Contract Events

While an Ethereum Smart Contract is being executed zero or more [Events](https://solidity.readthedocs.io/en/develop/contracts.html?highlight=events#events)  may be emitted asynchronously. Engine provides an Event Subscription service that will listen for events from a specific contract and POST the request to a registered URL.

There are 2 RPC endpoints for managing these subscriptions.

#### Subscribe

Create an Event Subscription entity in Engine.  This accepts a single JSON parameter with 2 required fields and 3 optional fields that describe the subscription.

```JS
{
  "method": "event.subscribe",
  "params": [{
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
  }],
  "jsonrpc": "2.0",
  "id": 0
}
```

Once an Event Subscription is created it will begin looking for Events after the given interval has passed.  If Engine is restarted, any previously registered Event Subscriptions will restart their search from the last successful block they sent to the callback URL.

If multiple event names are provided, the callback URL will be called once for each event type with a list of events matching that type.  If only one event name is included then all matching events will be posted in one request to the callback URL (this is still true when using the "allEvents" default).

If a request to the callback URL fails for any reason, Engine will retry after the interval timeout.  After 3 failures the Event Subscription paused.

1. Each time Engine is restarted, any Event Subscriptions in a failed state will have a single chance to successfully send a request to the callback URL before being paused again. However, if the callback succeeds, the Event Subscription will no longer be in a failure state and will continue as normal.
2. The subscriber may re-subscribe at any point with the same callback URL.  This will recreate the Event Subscription without being in a failure state.

At any point the subscriber may re-subscribe with the same callback URL and new parameters.  This will recreate the Event Subscription with the new parameters.

#### Unsubscribe

Remove an existing Event Subscription. The Event Subscription will no longer be restarted when Engine restarts. The only parameter is the URL of an existing Subscription.

```JS
{
  "method": "event.unsubscribe",
  "params": ["http://transmission.local/api/v1/contract/events/"],
  "jsonrpc": "2.0",
  "id": 0
}
```

## Built With

* [Web3.js](https://web3js.readthedocs.io/en/1.0/index.html) - Ethereum JavaScript API
* [TypeORM](http://typeorm.io/) - ORM / Entity Management

<!--## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.

All Typescript source files are run through Prettier to maintain a consistent style.  This can be executed via Docker by running the command

```
bin/ddo npm run prettier
```
-->

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/shipchain/engine/tags).

## Authors

* **Lucas Clay** - [mlclay](https://github.com/mlclay)
* **Leeward Bound** - [linked](https://github.com/linked)
* **Adam Hodges** - [ajhodges](https://github.com/ajhodges)
* **James Neyer** - [jamesfneyer](https://github.com/jamesfneyer)

<!--See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.-->

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details

