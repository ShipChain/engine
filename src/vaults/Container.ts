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

import { Wallet } from '../entity/Wallet';
import { Vault } from './Vault';

export abstract class Container {
    static EMBEDDED_REFERENCE: string = 'VAULTREF#';
    public vault: Vault;
    public name: string;
    public meta: any;
    public container_type: string;
    protected modified_raw_contents: boolean = false;

    protected constructor(vault: Vault, name: string, meta?: any) {
        this.vault = vault;
        this.name = name;
        this.meta = meta || {
            roles: [Vault.OWNERS_ROLE],
        };
    }

    // authorize_role(author: Wallet, role: string) {
    //     this.meta.roles.push(role);
    //     // Adding a role to a Container will need to re-encrypt the data for the new key
    //     this.vault.logAction(author, 'container.authorize_role', {
    //         role,
    //         container_type: this.container_type,
    //         name: this.name,
    //     });
    // }

    abstract async encryptContents();

    abstract async decryptContents(user: Wallet);

    abstract async buildMetadata(author: Wallet);

    abstract async verify();

    async updateLedger(author: Wallet, action: string, params?: any, output?: any) {
        if (this.name === Vault.LEDGER_CONTAINER) {
            return;
        }
        return await this.vault.updateLedger(author, {
            action: 'container.' + this.container_type + '.' + action,
            name: this.name,
            params,
            output,
        });
    }
}

export interface ListContentContainer {
    append(author: Wallet, blob: any);
}

export interface SingleContentContainer {
    setContents(author: Wallet, blob: any);
}

export interface MultiContentContainer {
    setSingleContent(author: Wallet, fileName: string, blob: any);
    listFiles();
}
