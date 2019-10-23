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

#### Configuration Files

Inside the `config` folder, there are configuration files there is a `default.ts` which provides a
baseline for configuration settings as well as several files for specific deployed environments
which follow this format `<ENV>.ts`. All the default configuration values should go into the
default.ts. The specific stages will inherit the values of entries from default.ts by default, while
overwriting them if some entries re-defined in a specific STAGE_NAME.ts.

Besides the above, you can write a local.ts file to overwrite any configuration
for your local run, which will overwrite  However, DO NOT add the local.ts to
the git repository. 

For more details of the precedence of different configuration options, you can
refer to [File Load Order](https://github.com/lorenwest/node-config/wiki/Configuration-Files#file-load-order)
and [Command Line Overrides](https://github.com/lorenwest/node-config/wiki/Command-Line-Overrides)

Some of the configuration settings are overridable via environment variables. For these to take
effect, they configuration setting -> environment variable mapping has to be made in
`config/custom-environment-variables.ts`. See the
[documentation](https://github.com/lorenwest/node-config/wiki/Environment-Variables#custom-environment-variables)
on this feature for more details.

#### Environment Variables

When utilizing the provided scripts in the `bin` directory to manage the Docker containers, a file
in the base folder named `.env` is sourced. This allows you to inject environment variables in to
the launched containers. You will need to create this file in your local environment.

##### Ethereum Provider Services

When connecting to a standard public network, ethers.js will use pre-defined API Access Keys for
Infura and Etherscan. Both providers will be used at once, falling back to the other after an error
threshold . If you want to provide your own access keys to track your usage or to handle your own
rate limits, set one or both of the following environment variables:

 - `INFURA_PROJECT_ID`
 - `ETHERSCAN_API_KEY`

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
`redis://:redis_pass@redis_db:6379/1`. We use this when interacting with vaults to ensure that
changes don't overlap. In order to use this, set:
 - `REDIS_URL` - With the format `redis://[:password@]host[:port][/db-number][?option=value]`

##### Private Key Encryption
Engine encrypts the Wallet `private_key` fields utilizing the EthCrypto library with a Master
Private Key. That Master private key is pulled from AWS Secrets Manager in a deployed environment,
but in a local development environment, you are required to specify your own by setting:
 - `LOCAL_SECRET_KEY` - This needs to be a properly formatted Ethereum private key (beginning with
   `0x`). The default value if none is specified is
   `0x0000000000000000000000000000000000000000000000000000000000000001`

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
  "method": "<rpc-method-name>",
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

### Database Entities

When interacting with Engine via RPC, most of the methods invoked will require a reference to some
known entity. Typically a Wallet or a StorageCredential. These are the only user-managed persistent
data objects stored within Engine's RDBMS (Postgres by default). See the full description of these
entities in [HostedEntities.md](docs/HostedEntities.md)

### Vaults

Many types of documents and data points need to be tied to a tracked entity. However, storing large
amounts of data on the blockchain is prohibitively expensive. To combat the high cost of data
storage while maintaining the guarantee of data integrity for a shipment's related data, Engine has
Vaults.

A Vault is a JSON datastore with embedded, encrypted content held within container sub-objects,
role-based access to those containers, a log of the previous actions, and a signed hash of the full
vault. The vault's hash is generated via the keccak256 hashing algorithm and is stored in the
blockchain to allow 3rd party validation that both the encrypted data within a vault has not been
tampered with and the hash was generated by the owner of that vault (or other Wallet with
appropriate role-based access).

##### Link Container

Engine supports cross-vault links. A new Container type was created: `link`. Containers of this type
includes an unencrypted mapping of `linkId: linkEntry`. The Link ID is expected to be a string UUID,
but can be managed by any specific Vault that utilizes this container type. LinkEntry is a new
structure that contains the information required to access specific data in a vault:

```JSONC
export class LinkEntry {
  remoteUrl?: string; // `schema://host:port` of the other Engine RPC server
  remoteVault: string; // Vault ID
  remoteWallet: string; // Wallet ID in remote Engine for decrypting data
  remoteStorage: string; // StorageCredentials ID in remote Engine for opening vault
  container: string;
  revision: number;
  hash: string;
  subFile?: string;
}
```

###### Getting the Data

When retrieving the linked data, a RemoteVault instance is created with the LinkEntry. This contains
2 logical branches for performing the actual retrieval; either the remoteUrl field is present or it
is empty.

###### RemoteUrl Provided

If the `LinkEntry.remoteUrl` exists, then this Engine needs to retrieve the data from another Engine
exposed at the provided URL. The `RemoteVault.sendOutgoingRequestToRemote()` method is invoked to
make an RPC call to the remote URL. This utilizes the JSON-RPC2 client to build the appropriate
request and calls the newly exposed `vaults.linked.get_linked_data` method with the contents of the
linkEntry as the payload.

On the receiving Engine instance, this new endpoint creates another RemoteVault instance with the
provided LinkEntry and invokes the `RemoteVault.getLinkedDataInternally()` method. The included
storage and vault IDs are used to open the vault. Then the container, revision, and optionally
subFile properties are passed to `getHistoricalDataBySequence` to decrypt the specific data to return
to the caller.

###### RemoteUrl Empty

If the `LinkEntry.remoteUrl` does not exist, the RemoteVault will skip creating the RPC Client and
will instead skip straight to the `RemoteVault.getLinkedDataInternally()` method as the "remote" IDs
all exist in the current Engine instance.

#### Load Vault

See legacy Load Vault documentation in [LoadVault.md](docs/LoadVault.md)

#### ShipChain Vault

A more flexible vault has been created that supports Primitive data structures. See
[Primitives.md](docs/Primitives.md) for details on the Primitive definitions. Ideally, a 
ShipChainVault will contain one Primitive and a collection of ShipChainVaults will be utilized for
the supply chain lifecycle (including the Procurement, one or more Shipments, Tracking data,
specific Items in a Shipment, Documents, etc)

For more details, see [ShipChainVault.md](docs/ShipChainVault.md)

### Smart Contracts

When the main Engine RPC server starts, it will download the latest version of ShipChain's smart
contract metadata from a [public URL](https://s3.amazonaws.com/shipchain-contracts/meta.json). This
metadata contains the deployed contract addresses for public Ethereum networks as well as the ABI
and compiled binary data. All relevant information will be parsed and loaded in to Engine's included
Postgres database for later use. There should be no further steps if you are using ShipChain's smart
contracts.

Engine currently supports these Smart Contracts:
- [Load 1.1.0](docs/LoadContract_1.1.0.md)

#### Multiple Requests Needed

Until this point, most actions in Engine required a single RPC Method invocation. When interacting
with the Smart Contracts you will need to perform _three_ separate requests for most actions. Any
Smart Contract RPC method that ends with `_tx` will only generate the _transaction_ for the request.
You will still need to Sign and Send this transaction via the Transaction RPC Namespace methods.

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

Create an Event Subscription entity in Engine. This accepts a single JSON parameter with 3 required
fields and 3 optional fields that describe the subscription.

```JSONC
{
  "method": "event.subscribe",
  "params": {
    // Required - Endpoint that accepts the Events via a POST
    "url": "http://transmission.local/api/v1/contract/events/",

    // Required - The name of a Contract loaded during Engine configuration
    "project": "LOAD",

    // Required - The specific version of a contract to subscribe to events from
    "version": "1.2.0",

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

The Project and Version combination must exist within the loaded Contract Fixtures or from a legacy
contract defined in Engine's database.

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
Engine restarts. The required parameters are the specific Project, URL, and Version of an existing
Subscription.

```JSON
{
  "method": "event.unsubscribe",
  "params": {
    "url": "http://transmission.local/api/v1/contract/events/",
    "project": "LOAD",
    "version": "1.2.0"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

## Built With

* [ethers.js](https://docs.ethers.io/ethers.js/html/) - Ethereum JavaScript API
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
* **Clovis Djiometsa** - [clovisdj](https://github.com/ClovisDj)

<!--See also the list of [contributors](https://github.com/your/project/contributors) who participated-->
<!--in this project.-->

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details

