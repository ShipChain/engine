## Primitives

Engine needs the ability to support flexible data structures and cross-vault references while
retaining semi-rigid definitions of known vault content. Primitives are an attempt to fulfill those
goals within the existing Vault system.

These Primitives have been designed to provide further granularity into and expand the functionality
of the ShipChain platform to include the entire spectrum of supply chain lifecycle events.

A Primitive is an extension of the Containers concept. These specialized containers consist of a
known internal structure with specific access methods for the data format. Most Primitives are built
upon the `EmbeddedFileContainer` type as typically it is non-list-based data that is being stored.
Additionally since Primitives are designed to hold a small subset of the data during the
supply-chain lifecycle, the storage requirements in each Primitive is low.

Fields contained in a primitive are classified as either official or unofficial fields. Official
fields are native to the ShipChain ecosystem and are those explained in the definitions below.
Unofficial fields are custom user fields that can be incorporated into any primitive as a user sees
fit, and will not be detailed in this documentation.

### Procurement

A Procurement is the top hierarchical structure in the ShipChain ecosystem. It functions as the
parent to a single or multiple shipments and can contain references to products that are being
requested in a supply chain request. A Procurement can be created either prior to or at the time of
purchase order exchange, and will serve as the parent organizational structure to any shipments
associated with the purchase order or supply chain lifecycle. Procurements can be used to group
shipments and documents in a single manageable container. They have been provided in the ShipChain
ecosystem as a means of monitoring orders across multiple levels of supply chain interactions.

The Procurement primitive contains the following official fields:

- Name
- Description

A Procurement can contain links to:

- Shipments
- Products (with quantities)
- Documents

##### Example Usage

A Procurement for 20,000 Widgets may contain links to the Widget Product and a specified quantity,
any related Documents, and Shipments that contain any of the 20,000 widgets. It can be used to
monitor the status and other information regarding orders from the buyers perspective.

### Shipment

A Shipment is the largest unit of measure for a moving unit container in the ShipChain ecosystem. It
contains linked information regarding the contents and movements of the container, and houses
references to the Items that are included in the shipment. Shipments have been included in the
ShipChain ecosystem to enable macro track and trace capabilities into supply chain movements.

A Shipment's official fields are defined in the [Schema](http://schema.shipchain.io/1.2.1/shipment.json)

A Shipment can contain links to:

- Documents
- Tracking
- Items (with quantities)

##### Example Usage

A Shipment containing a reference to 10,000 Widget Items is created from the Procurement request
previously above. This Shipment primitive will enable tracking of the moving unit through logistical
milestones.

### Product

A Product is the static record of a physical good or tangible item. A group of product links may be
used as a product catalog. Because products may require MSDS or other product specific
documentation, a product may contain links to documents. Product records are used to create
individualized Items at certain points in the supply chain lifecycle. Products have been included in
the ShipChain ecosystem to provide a means of reference for users to indicate certain goods or
materials.

The Product primitive contains the following official fields:

- SKU
- Name
- Description
- Price
- Color
- Weight
- Dimensions

A Product can contain links to

- Documents

##### Example Usage

User Sally Sitwell produces Sprockets, a competing product to the popular Widget. She creates a
Product containing the Sprocket so that it can be used to place orders for her goods and referenced
when shipping specific Items based on the Sprocket Product.


### Item

An Item is a line-item representation of a serialized or otherwise individualized physical item that
is used to signify a product included in a shipment. While a Product may refer to a finished good in
general, an Item references a specific physical good. The Item primitive can be used to further
define a product and may or may not contain serialized or specific lot information regarding the
item. Items have been included in the ShipChain ecosystem to provide line-item support and
individual entity track and trace.

The Item primitive contains the following official fields:

- Serial Number
- Batch ID
- Lot Number
- Price
- Expiration Date

An Item can contain a links to a single:

- Product

##### Example Usage

A Sprocket may be referenced as a product, but a particular Sprocket from Lot `1234` and Batch
`ABCD` may be referenced as an Item and included in a Shipment. When a Shipment is created, an Item
will be generated from the referenced Product primitive. A user can then add serialized information
regarding that particular item to the Vault record.

### Document

A Document references any documentation or images that may be required in the supply chain
lifecycle. Bills of Lading, Commercial Invoices, Waybills, Pictures, Purchase orders, etc are all
examples of document types that may be included within the Document primitive.

A Document contains the following official fields:

- Name
- Description
- File Type

Because Documents currently exist to provide supporting data or ownership rights to other vault
primitives, A Document does not inherently contain links to any other primitives.

##### Example Usage

Shipment `9f1577d0-229a-480b-8da1-25315d1a385c` contains a reference to a Bill of Lading Document
that transfers ownership as the Shipment progresses throughout the logistics lifecycle.
    
### Tracking

Tracking is the list of coordinates related to supply chain or logistics movements. Tracking has
been included in the ShipChain ecosystem to provide up-to-date location information regarding supply
chain movements.

Official Tracking fields are defined in the [Schema](http://schema.shipchain.io/1.2.1/tracking.json)

Because Tracking currently exists to provide supporting information regarding the whereabouts of
other Primitives, it does not natively contain links to any other Primitives.

##### Example Usage

Shipment `9f1577d0-229a-480b-8da1-25315d1a385c`, including 10,000 Widget Items, is linked to a list
of locations that provide insight into the movements of the Shipment and in turn the linked Items.
