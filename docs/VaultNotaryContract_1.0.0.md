### VaultNotary Contract 1.0.0

The VaultNotary contract contains the functions to create, update and read the URI and Hash 
of vaults, and the functions that manages the access control of addresses to the setter functions. 

This is the first version of this contract, i.e. Version 1.0.0. 

The version has the following endpoints,

####1. Record Creation

##### Register a Vault
```JSON
{
	"method": "notary.register_vault_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"vaultUri": "s3://my-bucket/2ed96ba9-26d4-4f26-b3da-c45562268480/meta.json", 
		"vaultHash": "0x0f021e716c58d1e53222bf1cf9dfe8740470ef8d4a125499b26de58049688563"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

Note both vaultId and senderWallet are UUIDs. The response of this call also has a
`contractVersion` field similar to the `createNewShipment` endpoint in the Load contract. 
 
An example of a response, 
```JSON
{
    "jsonrpc": "2.0",
    "id": 0,
    "result": {
        "success": true,
        "contractVersion": "1.0.0",
        "transaction": {
            "nonce": "0x00",
            "chainId": 1337,
            "data": "0x885bcd360000000000004000b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000003d73333a2f2f6d792d6275636b65742f32656439366261392d323664342d346632362d623364612d6334353536323236383438302f6d6574612e6a736f6e0000000000000000000000000000000000000000000000000000000000000000000042307830663032316537313663353864316535333232326266316366396466653837343034373065663864346131323534393962323664653538303439363838353633000000000000000000000000000000000000000000000000000000000000",
            "to": "0xa2207BB135287a4EB3ae4De32A0b99d112ae57B0",
            "gasPrice": "0x0430e23400",
            "gasLimit": "0x0637e0",
            "value": "0x00"
        }
    }
}
```

####2. URI and Hash Getter

##### Get the Vault Information
```JSON
{
	"method": "notary.1.0.0.get_vault_notary_details",
	"params": {
		"vaultId": "{{vault_id}}"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

An example response,
```JSON
{
    "jsonrpc": "2.0",
    "id": 0,
    "result": {
        "success": true,
        "details": {
            "0": "s3://my-bucket/2ed96ba9-26d4-4f26-b3da-c45562268480/meta.json",
            "1": "0x0f021e716c58d1e53222bf1cf9dfe8740470ef8d4a125499b26de58049688563",
            "2": "0xb574E56D67201580c21c1CD5Aa7Da34156dB5A60",
            "vaultUri": "s3://my-bucket/2ed96ba9-26d4-4f26-b3da-c45562268480/meta.json",
            "vaultHash": "0x0f021e716c58d1e53222bf1cf9dfe8740470ef8d4a125499b26de58049688563", 
            "vaultOwner": "0xb574E56D67201580c21c1CD5Aa7Da34156dB5A60"
        }
    }
}
```

####3. URI and Hash Setters

##### Set the Vault URI
```JSON
{
	"method": "notary.1.0.0.set_vault_uri_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"vaultUri": "s3://my-bucket/2ed96ba9-26d4-4f26-b3da-c45562268480/meta.json"
	},
	"jsonrpc": "2.0",
	"id": 0
} 
```

This will set the URI of the vault with `vaultId` to `vaultUri`. 


##### Set the Vault Hash
```JSON
{
	"method": "notary.1.0.0.set_vault_hash_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"vaultHash": "0x0g021e716c58d1e53222bf1cf9dfe8740470ef8d4a125499b26de58049688563"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

This will set the Hash of the vault with `vaultId` to `vaultHash`. 


####4. Access Control Functions
##### Grant the Permission to Update the Vault URI
```JSON
{
	"method": "notary.1.0.0.grant_update_uri_permission_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"toGrantWallet": "bf6204a5-5e1a-458c-a180-c54cc35d05a2"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

This will grant the permission to update the URI of the vault with `vaultId` to 
the address `toGrantWallet`.


##### Revoke the Permission to Update the Vault URI
```JSON
{
	"method": "notary.1.0.0.revoke_update_uri_permission_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"toRevokeWallet": "bf6204a5-5e1a-458c-a180-c54cc35d05a2"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

This will revoke the permission to update the URI of the vault with `vaultId` from 
the address `toRevokeWallet`.


##### Grant the Permission to Update the Vault Hash

```JSON
{
	"method": "notary.1.0.0.grant_update_hash_permission_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"toGrantWallet": "bf6204a5-5e1a-458c-a180-c54cc35d05a2"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

This will grant the permission to update the URI of the vault with `vaultId` to 
the address `toGrantWallet`.

##### Revoke the Permission to Update the Vault Hash

```JSON
{
	"method": "notary.1.0.0.revoke_update_hash_permission_tx",
	"params": {
		"vaultId": "{{vault_id}}",
		"senderWallet": "{{wallet_id}}", 
		"toRevokeWallet": "bf6204a5-5e1a-458c-a180-c54cc35d05a2"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

This will revoke the permission to update the URI of the vault with `vaultId` from 
the address `toRevokeWallet`.

  





