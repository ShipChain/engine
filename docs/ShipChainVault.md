
### ShipChain Vault

A more flexible vault has been created that supports Primitive data structures. See
[Primitives.md](Primitives.md) for details on the Primitive definitions. Ideally, a ShipChainVault will
contain one Primitive and a collection of ShipChainVaults will be utilized for the supply chain
lifecycle (including the Procurement, one or more Shipments, Tracking data, specific Items in a
Shipment, Documents, etc)

#### Create

A vault's location is defined within the context of a Storage Driver. When defining a vault, you
must provide an ID of a [Storage Credential](HostedEntities.md#storage-credentials) as well as
the Owner of the vault

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

#### Inject

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

#### Primitive Interaction

Once a Primitive has been added to a ShipChainVault, the Primitive can be interacted with via the
methods injected specifically for that PrimitiveType. I.E. to modify the descriptive fields of a
Document, you would call the RPC method `vaults.shipchain.document.fields.set` with the appropriate
parameters (defined below).

##### Common Methods

###### Fields

All singular Primitives (i.e. not _List_ primitives) with the exception of Tracking, have a `fields`
element that can be accessed via the exposed RPC methods
`vaults.shipchain.<primitive>.fields.{set,get}`.

```JSON
{
  "method": "vaults.shipchain.document.fields.set",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "fields": {
      "name": "Document #1"
    }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

###### List Type

All Primitives (with the exception of Tracking) have an associated <Primitive>List type defined as
well. These List versions of the Primitives are designed to hold references to multiple instances of
of that Primitive Type. All List Primitives include the same 4 methods for accessing and modifying
the collection. These methods are:

- get
- add
- list
- count

Internally, the Lists hold a mapping of `linkId` -> `linkEntry`. The linkId is typically the vaultId
of the associated Primitive being referenced. And the linkEntry is going to be the
[LinkEntry](../README.md#link-container) that describes how to connect to the remote Primitive;
either in Object format, or in the new `VAULTREF#` format in this snippet:

```JSON
{
  "method": "vaults.shipchain.documentList.add",
  "params": {
    "storageCredentials": "a350758d-2dd8-4bab-b983-2390657bbc25",
    "vaultWallet": "eea40c56-7674-43a5-8612-30abd98cf58b",
    "vault": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "linkId": "2ed96ba9-26d4-4f26-b3da-c45562268480",
    "linkEntry": "VAULTREF#{{engine_url}}/{{vault_id}}/{{storage_credential_id}}/{{wallet_id}}/Document"
  },
  "jsonrpc": "2.0",
  "id": 0
}
```
