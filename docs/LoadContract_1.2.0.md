### Load Contract 1.2.0

The major differences of this version of Load Contract compared with the previous 1.1.0 version are,
 
* An extra `carrierWallet` parameter in the `create_shipment_tx` call. The top level
`load.create_shipment_tx` is now updated to use the 1.2.0 version `create_shipment_tx` which returns 
a response with the `contractVersion` field as `"1.2.0"` (The contract version return scheme 
is detailed in [Load 1.1.0 Contract Version section](./LoadContract_1.1.0.md#Contract-Version)). 

  Now the new `create_shipment_tx` should be called as follows,
  
```JSON
{
	"method": "load.1.2.0.create_shipment_tx",
	"params": {
		"shipmentUuid": "77777777-25fe-465e-8458-0e9f8ffa2cdd",
		"senderWallet": "8ca1e0df-26ff-4331-86f7-61a1cdcb06c9", 
		"fundingType": 1, 
		"contractedAmount": 10000000000000, 
		"carrierWallet": "8595c618-a448-4ba8-810f-6fc090da7f40"
	},
	"jsonrpc": "2.0",
	"id": 0
}
```

As we have described, the only difference is the added `carrierWallet`, compared with
the version 1.1.0. 
  
* Removed all the methods/endpoints related to the uri and hash. Those functions are now separated
into a new Notary contract. The information about the rpc calls to this new contract 
can be found at  [VaultNotary 1.0.0](./VaultNotaryContract_1.0.0.md)


