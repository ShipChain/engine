/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, update the JSONSchema referenced in
 * ingestPrimitives.js, and run `npm run ingest_primitives` to regenerate this file.
 */

/**
 * The ID of the Shipment
 */
export type ShipmentUUID = string;
/**
 * Standard Carrier Alpha code used for the carrier
 */
export type CarrierSSCAC = string;
/**
 * Standard Carrier Alpha code used for the forwarder
 */
export type ForwarderSSCAC = string;
/**
 * Standard Carrier Alpha code used for the Non-Vessel Operating Common Carrier (NVOCC)
 */
export type NVOCCSSCAC = string;
/**
 * Reference number of this shipment assigned by the Shipper
 */
export type TheShippersReferenceNumberSchema = string;
/**
 * Reference number of this shipment assigned by the Forwarder
 */
export type TheForwardersReferenceNumberSchema = string;
/**
 * ID of the Shipper assigned by the Forwarder
 */
export type ForwarderSIdAssignedToTheShipper = string;
/**
 * The ID of the Location
 */
export type LocationUUID = string;
/**
 * The name of the Location
 */
export type LocationName = string;
/**
 * The first line of the location's address
 */
export type Address1 = string;
/**
 * The second line of the location's address
 */
export type Address2 = string;
/**
 * The city of the location
 */
export type City = string;
/**
 * The state of the location
 */
export type State = string;
/**
 * The country of the location
 */
export type Country = string;
/**
 * The postal/zip code of the location
 */
export type PostalCode = string;
/**
 * Phone number of the location's primary contact
 */
export type PhoneNumber = string;
/**
 * Fax number of the location's primary contact
 */
export type FaxNumber = string;
/**
 * Timestamp of the last update
 */
export type UpdatedAt = string;
/**
 * Timestamp of the object creation
 */
export type CreatedAt = string;
/**
 * Instructions for Carrier
 */
export type TheCarriersInstructionsSchema = string;
/**
 * PRO number for LTL shipments
 */
export type TheProNumberSchema = string;
/**
 * Master bill number
 */
export type TheBillMasterSchema = string;
/**
 * House bill number
 */
export type TheBillHouseSchema = string;
/**
 * Sub-House bill number
 */
export type TheBillSubhouseSchema = string;
/**
 * Shipment payment terms
 */
export type ThePaymentTermsSchema = string;
/**
 * Vessel or ship name carrying shipment
 */
export type TheVesselNameSchema = string;
/**
 * Unique voyage number
 */
export type TheVoyageNumberSchema = string;
/**
 * Type of transport shipment will be using
 */
export type TheModeOfTransportCodeSchema = string;
/**
 * Number of packages in shipment
 */
export type ThePackageQtySchema = number;
/**
 * Gross weight in Kilograms
 */
export type TheWeightGrossSchema = number;
/**
 * Volume in cubic meters
 */
export type TheVolumeSchema = number;
/**
 * Number of containers in the shipment
 */
export type TheContainerQtySchema = number;
/**
 * Estimated weight that is calculated from the length, width and height of shipment
 */
export type TheWeightDimSchema = number;
/**
 * Weight of the shipment used for billing
 */
export type TheWeightChargeableSchema = number;
/**
 * Timestamp of when the transporter received the shipment
 */
export type TheDocsReceivedActSchema = string;
/**
 * Timestamp of when the transporter confirmed the shipment's details were complete and valid
 */
export type TheDocsApprovedActSchema = string;
/**
 * Appointment timestamp for pickup from origin
 */
export type ThePickupApptSchema = string;
/**
 * Estimated timestamp for pickup from origin
 */
export type ThePickupEstSchema = string;
/**
 * Actual timestamp pickup occured at point of origin
 */
export type ThePickupActSchema = string;
/**
 * Estimated timestamp for loading to begin
 */
export type TheLoadingEstSchema = string;
/**
 * Actual timestamp that loading began
 */
export type TheLoadingActSchema = string;
/**
 * Estimated timestamp of departure
 */
export type TheDepartureEstSchema = string;
/**
 * Actual timestamp of departure
 */
export type TheDepartureActSchema = string;
/**
 * Delivery appointment timestamp
 */
export type TheDeliveryApptSchema = string;
/**
 * Estimated timestamp of arrival at destination port
 */
export type TheArrivalPortEstSchema = string;
/**
 * Timestamp of actual arrival at destination port
 */
export type TheArrivalPortActSchema = string;
/**
 * Estimated timestamp of delivery
 */
export type TheDeliveryEstSchema = string;
/**
 * Actual timestamp of delivery
 */
export type TheDeliveryActSchema = string;
/**
 * Timestamp of last attempted delivery
 */
export type TheDeliveryAttemptSchema = string;
/**
 * Timestamp for cancellation request
 */
export type TheCancelRequestedDateActSchema = string;
/**
 * Timestamp for cancellation confirmation
 */
export type TheCancelConfirmedDateActSchema = string;
/**
 * Timestamp of actual customs filed date
 */
export type TheCustomsFiledDateActSchema = string;
/**
 * Timestamp of hold by customs
 */
export type TheCustomsHoldDateActSchema = string;
/**
 * Timestamp of release by customs
 */
export type TheCustomsReleaseDateActSchema = string;
/**
 * Type of container being used for the shipment
 */
export type TheContainerTypeSchema = string;
/**
 * UN/LOCODE for destination port
 */
export type TheArrivalLocodeSchema = string;
/**
 * UN/LOCODE for final destination port
 */
export type TheFinalPortLocodeSchema = string;
/**
 * UN/LOCODE for import
 */
export type TheImportLocodeSchema = string;
/**
 * UN/LOCODE for lading
 */
export type TheLadingLocodeSchema = string;
/**
 * UN/LOCODE for the origin
 */
export type TheOriginLocodeSchema = string;
/**
 * Whether the US export is routed
 */
export type TheUsRoutedSchema = boolean;
/**
 * Mode of Transportation code used by the customs authority for the country where the shipment's import declaration will be filed
 */
export type TheImportCustomsModeSchema = string;
/**
 * US Customs code for port of export
 */
export type TheUsExportPortSchema = string;
/**
 * Timestamp of resource update
 */
export type TheUpdatedAtSchema = string;
/**
 * Timestamp of resource creation
 */
export type TheCreatedAtSchema = string;
/**
 * Version of shipment data format
 */
export type Version = string;

export interface Shipment {
  id: ShipmentUUID;
  carriers_scac?: CarrierSSCAC;
  forwarders_scac?: ForwarderSSCAC;
  nvocc_scac?: NVOCCSSCAC;
  shippers_reference?: TheShippersReferenceNumberSchema;
  forwarders_reference?: TheForwardersReferenceNumberSchema;
  forwarders_shipper_id?: ForwarderSIdAssignedToTheShipper;
  ship_from_location?: ShipFromAddress;
  ship_to_location?: ShipToAddress;
  final_destination_location?: ShipmentFinalDestination;
  carriers_instructions?: TheCarriersInstructionsSchema;
  pro_number?: TheProNumberSchema;
  bill_master?: TheBillMasterSchema;
  bill_house?: TheBillHouseSchema;
  bill_subhouse?: TheBillSubhouseSchema;
  payment_terms?: ThePaymentTermsSchema;
  vessel_name?: TheVesselNameSchema;
  voyage_number?: TheVoyageNumberSchema;
  mode_of_transport_code?: TheModeOfTransportCodeSchema;
  package_qty?: ThePackageQtySchema;
  weight_gross?: TheWeightGrossSchema;
  volume?: TheVolumeSchema;
  container_qty?: TheContainerQtySchema;
  weight_dim?: TheWeightDimSchema;
  weight_chargeable?: TheWeightChargeableSchema;
  docs_received_act?: TheDocsReceivedActSchema;
  docs_approved_act?: TheDocsApprovedActSchema;
  pickup_appt?: ThePickupApptSchema;
  pickup_est?: ThePickupEstSchema;
  pickup_act?: ThePickupActSchema;
  loading_est?: TheLoadingEstSchema;
  loading_act?: TheLoadingActSchema;
  departure_est?: TheDepartureEstSchema;
  departure_act?: TheDepartureActSchema;
  delivery_appt?: TheDeliveryApptSchema;
  arrival_port_est?: TheArrivalPortEstSchema;
  arrival_port_act?: TheArrivalPortActSchema;
  delivery_est?: TheDeliveryEstSchema;
  delivery_act?: TheDeliveryActSchema;
  delivery_attempt?: TheDeliveryAttemptSchema;
  cancel_requested_date_act?: TheCancelRequestedDateActSchema;
  cancel_confirmed_date_act?: TheCancelConfirmedDateActSchema;
  customs_filed_date_act?: TheCustomsFiledDateActSchema;
  customs_hold_date_act?: TheCustomsHoldDateActSchema;
  customs_release_date_act?: TheCustomsReleaseDateActSchema;
  container_type?: TheContainerTypeSchema;
  arrival_locode?: TheArrivalLocodeSchema;
  final_port_locode?: TheFinalPortLocodeSchema;
  import_locode?: TheImportLocodeSchema;
  lading_locode?: TheLadingLocodeSchema;
  origin_locode?: TheOriginLocodeSchema;
  us_routed?: TheUsRoutedSchema;
  import_customs_mode?: TheImportCustomsModeSchema;
  us_export_port?: TheUsExportPortSchema;
  updated_at?: TheUpdatedAtSchema;
  created_at?: TheCreatedAtSchema;
  customer_fields?: TheCustomerFieldsSchema;
  version: Version;
}
/**
 * The Shipment's ship-from address
 */
export interface ShipFromAddress {
  id: LocationUUID;
  name?: LocationName;
  address_1?: Address1;
  address_2?: Address2;
  city?: City;
  state?: State;
  country?: Country;
  postal_code?: PostalCode;
  phone_number?: PhoneNumber;
  fax_number?: FaxNumber;
  updated_at?: UpdatedAt;
  created_at?: CreatedAt;
}
/**
 * The Shipment's ship-to address
 */
export interface ShipToAddress {
  id: LocationUUID;
  name?: LocationName;
  address_1?: Address1;
  address_2?: Address2;
  city?: City;
  state?: State;
  country?: Country;
  postal_code?: PostalCode;
  phone_number?: PhoneNumber;
  fax_number?: FaxNumber;
  updated_at?: UpdatedAt;
  created_at?: CreatedAt;
}
/**
 * The Shipment's Final Destination address
 */
export interface ShipmentFinalDestination {
  id: LocationUUID;
  name?: LocationName;
  address_1?: Address1;
  address_2?: Address2;
  city?: City;
  state?: State;
  country?: Country;
  postal_code?: PostalCode;
  phone_number?: PhoneNumber;
  fax_number?: FaxNumber;
  updated_at?: UpdatedAt;
  created_at?: CreatedAt;
}
/**
 * An arbitrary JSON payload containing customer-specific fields
 */
export interface TheCustomerFieldsSchema {
  [k: string]: any;
}
