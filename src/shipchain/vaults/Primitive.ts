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
}

export abstract class PrimitiveCollection extends Primitive {
    linkEntries: any;
    count(): number {
        return Object.keys(this.linkEntries).length;
    }

    list(): String[] {
        return Object.keys(this.linkEntries);
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
