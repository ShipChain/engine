/*
 * Copyright 2019 ShipChain, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const nock = require('nock');
const nockedUrl = 'http://nocked-url:2000';

export function nockLinkedData(linkedPrimitive: string, times: number = 1) {
    return nock(nockedUrl)
        .post('/', (body) => {
            return body.method === 'vaults.linked.get_linked_data' &&
                body.params &&
                body.params.linkEntry &&
                body.params.linkEntry.container === linkedPrimitive;
        })
        .times(times)
        .reply(200, getNockedResponse(linkedPrimitive));
}


export function getNockableLink(linkedPrimitive: string): string {
    return `VAULTREF#${nockedUrl}/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/00000000-0000-4000-b000-000000000000/${linkedPrimitive}`;
}

const documentResponseData = {
    "fields": {
        "name": "Remote Document",
    },
    "content": null,
};

const productResponseData = {
    "fields": {
        "name": "Remote Product",
    },
    "documents": {
        "docId": getNockableLink("Document"),
    },
};

const trackingResponseData = [{
    "tracking_one": 1
}];

const telemetryResponseData = [{
    "telemetry_one": 1
}];

const itemResponseData = {
    "fields": {
        "serial_number": "Remote Item Serial #",
    },
    "product": getNockableLink("Product")
};

const shipmentResponseData = {
    "fields": {
        "id": "c70a9b2f-bad9-4ace-b981-807cbb44782d",
    },
    "documents": {
        "docId": getNockableLink("Document"),
    },
    "tracking": getNockableLink("Tracking"),
    "items": {
        "itemId": {
            "quantity": 1,
            "item": getNockableLink("Item"),
        },
    },
};

const ProcurementResponseData = {
    "fields": {
        "name": "Remote Procurement",
    },
    "shipments": {
        "shipmentId": getNockableLink("Shipment"),
    },
    "documents": {
        "docId": getNockableLink("Document"),
    },
    "products": {
        "productId": {
            "quantity": 1,
            "product": getNockableLink("Product"),
        },
    },
};

export function getPrimitiveData(linkedPrimitive: string): any {
    switch (linkedPrimitive) {
        case 'Document':
            return documentResponseData;
        case 'Product':
            return productResponseData;
        case 'Tracking':
            return trackingResponseData;
        case 'Telemetry':
            return telemetryResponseData;
        case 'Item':
            return itemResponseData;
        case 'Shipment':
            return shipmentResponseData;
        case 'Procurement':
            return ProcurementResponseData;
        default:
            throw new Error(`Unit Test requested invalid linkedPrimitive: [${linkedPrimitive}]`);
    }
}

const baseJsonRpcResponse = {
    'jsonrpc': '2.0',
    'result': null,
    'id': 0,
};

function getNockedResponse(linkedPrimitive: string): any {
    let nockedResponse = Object.assign({}, baseJsonRpcResponse);

    nockedResponse.result = getPrimitiveData(linkedPrimitive);

    if (linkedPrimitive !== 'Tracking' && linkedPrimitive !== 'Telemetry') {
        nockedResponse.result = JSON.stringify(nockedResponse.result);
    }

    return nockedResponse;
}
