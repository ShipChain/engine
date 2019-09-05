### Load Contract

The Load Contract is versioned using [SemVer](https://semver.org/). Engine supports interacting with
multiple versions of the Load Contract via different RPC Namespaces.

Every call to interact with a Shipment via the Load Contract will need to provide a ShipmentUUID.
This is currently managed via Transmission for ShipChain's instance of Engine. This UUID will be
transformed in to the byte16 lookup in to the Shipment Mapping in the contract.

NOTE: The methods outlined below are for version 1.1.0 only.

#### Helpful Information

During interaction with ShipChain's Load Contract, you may wish to review the source for the
specific contract version.

[https://github.com/ShipChain/smart-contracts/tree/1.1.0](https://github.com/ShipChain/smart-contracts/tree/1.1.0)

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