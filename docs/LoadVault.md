### Load Vault

A Load Vault is a legacy Engine 1.0 data storage entity. This vault contains multiple containers to
hold all data about a specific Shipment. This includes, Shipment Schema fields, documents, and
tracking data.

#### Create

A vault's location is defined within the context of a Storage Driver. When defining a vault, you
must provide an ID of a [Storage Credential](HostedEntities.md#storage-credentials) as well as the
Owner of the vault (the Shipper)

```JSON
{
  "method": "vault.create",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "shipperWallet": "eea40c56-7674-43a5-8612-30abd98cf58b"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

The object returned will include the newly created `vault_id`. This value will need to be provided
as the `vault` parameter to all remaining interactions with the Vault (as seen in the examples
below).

#### Verify

A vault's contents can be verified against the embedded, signed hash to ensure that there has been
no unauthorized modifications to the vault since the last update.

```JSON
{
  "method": "vault.verify",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

The object returned will include a boolean `verified` dependent on the verification of the data.

#### Tracking Data Container

One container in the vault is for logging the GPS coordinates and sensor status over the length of
the shipment.

##### Add

Appending new data points in this container is performed via:

```JSON
{
  "method": "vault.add_tracking",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "payload": {
      "position": {
        "latitude": -81.048253,
        "longitude": 34.628643,
        "altitude": 924,
        "source": "gps",
        "certainty": 95,
        "speed": 34
      },
      "version": "1.0.0",
      "device_id": "{{device_id}}"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Retrieve

Retrieving the existing data points in this container is performed via:

```JSON
{
  "method": "vault.get_tracking",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Shipment Data Container

One container in the vault is for storing the associated
[Shipment Primitive data](https://docs.shipchain.io/docs/shipment.html).

##### Add

Setting the Shipment data in this container is an overwrite action, not an append action. This is
performed via:

```JSON
{
  "method": "vault.add_shipment",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "shipment": {
      "id": "14D6A86b-b52e-4CBE-93AE-CEA5bA90fAcb",
      "carrier_scac": "F49S"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Retrieve

Retrieving the Shipment Data in this container is performed via:

```JSON
{
  "method": "vault.get_shipment",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Documents Container

One container in the vault is for storing files/documents related to a shipment.

##### Add

Adding a file in this container is an overwrite action, not an append, of any content already stored
by that `documentName`. The contents of the document should be provided as a string. The format of
this string is up to the user; a base64 encoded string is a recommended approach. This is performed
via:

```JSON
{
  "method": "vault.add_document",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "documentName": "example.png",
    "documentContent": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mN8U+T4nYEIwDiqkL4KAZKnGefMCAbPAAAAAElFTkSuQmCC"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Add From S3

An alternate approach to adding a file in this container is to request a file be copied from S3 and
added to the vault. This is performed via:

```JSON
{
  "method": "vault.add_document_from_s3",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "documentName": "example.png",
    "bucket": "test-bucket.mycompany.com",
    "key": "2808d10f-2d8c-47c6-9975-8e60fab55bac/7d3e338d-f610-408d-ab1b-0d789725f16d/example.png"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Retrieve

Retrieving one of the existing documents in this container is performed via:

```JSON
{
  "method": "vault.get_document",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "documentName": "example.png"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Add to s3

A document can be retrieved with the purpose to be put in a s3 bucket via:

```JSON
{
  "method": "vault.put_document_in_s3",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "documentName": "example.png",
    "bucket": "test-bucket.mycompany.com",
    "key": "2808d10f-2d8c-47c6-9975-8e60fab55bac/7d3e338d-f610-408d-ab1b-0d789725f16d/example.png"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```
##### List

Listing the files included in this container is performed via:

```JSON
{
  "method": "vault.list_documents",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

#### Historical Retrieval

An Engine Vault contains a running Ledger of all actions taken in each Container. This data is
encrypted with a special role and is viewable by users in that Ledger role only; by default the
Shipper is included in this role. This provides the ability to generate Vault data that was present
at any previous date by replaying previous actions up to the specified date.

Each of the above containers (shipment, tracking, documents) support this historical retrieval and
getting this prior data is handled via these RPC methods.

 - `get_historical_shipment_data`
 - `get_historical_tracking_data`
 - `get_historical_document`

These are called the same as their non-historical counterparts, except they require one of two
additional parameters `date` or `sequence`. These new parameters specify a version of the vault to
get the data from; either the date (UTC) or the vault sequence at which you wish to view the
contents.

##### Date

Specifying a Date will perform a type of "fuzzy" retrieval. If no contents existed before the date
you specify, you will receive an error indicating this. However, if data has existed prior to the
date you specify, then you will get the value of the data _that would have existed_ at the time,
even if there was no specific data storage action at that timestamp. The format of this new date
field follows the ISO8601 standard `YYYY-MM-DDTHH:mm:ss.SSSZ`.

For example, to retrieve the contents of the file `example.png` as it existed in the vault as of
2:00 pm UTC on November 1st, 2018 use the following request:

```JSON
{
  "method": "vault.get_document",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "documentName": "example.png",
    "date": "2018-11-01T14:00:00.000Z"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

##### Sequence

Specifying a sequence will perform an exact lookup in the ledger. If no data for the specified
container exists at the sequence you will receive an error indicating this. The only exception to
this is List based containers, these will still perform a scan through the ledger to rebuild the
data up to the specified index.