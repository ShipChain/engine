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

// Primitive Mixin
import { Container } from '../../vaults/Container';
import { Wallet } from '../../entity/Wallet';
import { LinkContainer, LinkEntry } from '../../vaults/containers/LinkContainer';
import { RemoteVault } from '../../vaults/RemoteVault';
import { PrimitiveType } from './PrimitiveType';

export abstract class Primitive extends Container {
    injectContainerMetadata() {
        this.meta['isPrimitive'] = true;
    }

    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<T> {
        let primitive;
        try {
            primitive = await this.decryptContents(wallet);
            primitive = JSON.parse(primitive);
        } catch (err) {
            primitive = {};
        }

        return new klass(primitive);
    }

    static validateLinkedPrimitive(linkEntry: LinkEntry | string, primitiveType: string): void {
        if (typeof linkEntry === 'string') {
            linkEntry = RemoteVault.buildLinkEntry(linkEntry);
        }
        if (!linkEntry || linkEntry.container !== primitiveType) {
            throw new Error(`Expecting Link to [${primitiveType}] instead received [${linkEntry ? linkEntry.container : 'invalid linkEntry'}]`);
        }
    }
}

export abstract class PrimitiveList extends LinkContainer implements Primitive {
    linkEntries: any;
    propertiesKlass: new (...args: any[]) => PrimitiveProperties;

    async addEntity(wallet: Wallet, entityId: string, entityLink: LinkEntry): Promise<void> {
        const thisPrimitiveType: PrimitiveType = PrimitiveType[this.name];
        Primitive.validateLinkedPrimitive(entityLink, thisPrimitiveType.listOf);
        await this.addLink(wallet, entityId, entityLink);
    }

    async getEntity<T extends PrimitiveProperties>(linkId: string): Promise<T> {
        let content: string = await this.getLinkedContent(linkId);
        let procurement: T = new this.propertiesKlass(JSON.parse(content)) as T;
        procurement = await RemoteVault.processContentForLinks(procurement);
        await procurement.process();
        return procurement;
    }
    count(): number {
        return Object.keys(this.linkEntries).length;
    }

    list(): String[] {
        return Object.keys(this.linkEntries);
    }

    // Primitive Mixin placeholders
    // ----------------------------
    injectContainerMetadata(): void {}
    async getPrimitiveProperties<T extends PrimitiveProperties>(
        klass: new (...args: any[]) => T,
        wallet: Wallet,
    ): Promise<T> {
        return undefined;
    }
}

export abstract class PrimitiveProperties {
    protected constructor(initializingJson: any = {}, initializeCallback?: any) {
        if (initializeCallback) {
            initializeCallback(this);
        }
        for (let property in initializingJson) {
            if (initializingJson.hasOwnProperty(property) && (!initializeCallback || this.hasOwnProperty(property))) {
                this[property] = initializingJson[property];
            }
        }
    }

    abstract async process();
}
