/*
 * Copyright 2019 ShipChain, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this content except in compliance with the License.
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

import { Primitive, PrimitiveProperties } from '../Primitive';
import { PrimitiveType } from '../PrimitiveType';
import { ShipChainVault } from '../ShipChainVault';

import { EmbeddedFileContainer } from '../../../vaults/containers/EmbeddedContainer';
import { applyMixins } from '../../../utils';

import { Wallet } from '../../../entity/Wallet';
import { RemoteVault } from '../../../vaults/RemoteVault';

export class DocumentProperties extends PrimitiveProperties {
    fields: {
        name?: string;
        description?: string;
        file_type?: string;
    };
    content: string;

    constructor(initializingJson: any = {}) {
        super(initializingJson, DocumentProperties.initializeProperties);
    }
    static initializeProperties(primitive: any) {
        primitive.fields = {};
        primitive.content = null;
    }
}

export class Document extends EmbeddedFileContainer implements Primitive {
    constructor(vault: ShipChainVault, meta?: any) {
        super(vault, PrimitiveType.Document.name, meta);
        this.injectContainerMetadata();
    }

    // FULL DOCUMENT ACCESS
    // ====================
    async getDocument(wallet: Wallet): Promise<DocumentProperties> {
        let document: DocumentProperties = await this._getData(DocumentProperties, wallet);
        return await RemoteVault.processContentForLinks(document);
    }

    async setDocument(wallet: Wallet, fields: any, content: string): Promise<void> {
        let newDocument = new DocumentProperties({
            fields: fields,
            content: content,
        });
        await this.setContents(wallet, JSON.stringify(newDocument));
    }

    // FIELD ACCESS
    // ============
    async getFields(wallet: Wallet): Promise<string> {
        let document: DocumentProperties = await this._getData(DocumentProperties, wallet);
        return await RemoteVault.processContentForLinks(document.fields);
    }

    async setFields(wallet: Wallet, documentFields: any): Promise<void> {
        let document: DocumentProperties = await this._getData(DocumentProperties, wallet);
        document.fields = documentFields;
        await this.setContents(wallet, JSON.stringify(document));
    }

    // CONTENT ACCESS
    // ==============
    async getContent(wallet: Wallet): Promise<string> {
        let document: DocumentProperties = await this._getData(DocumentProperties, wallet);
        return await RemoteVault.processContentForLinks(document.content);
    }

    async setContent(wallet: Wallet, documentContent: string): Promise<void> {
        let document: DocumentProperties = await this._getData(DocumentProperties, wallet);
        document.content = documentContent;
        await this.setContents(wallet, JSON.stringify(document));
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
    async _getData(klass: typeof PrimitiveProperties, wallet: Wallet): Promise<any> {
        return;
    }
}

applyMixins(Document, [Primitive]);
