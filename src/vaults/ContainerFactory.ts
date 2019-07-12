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

import { Container } from './Container';
import { Vault } from './Vault';

import { EmbeddedFileContainer, EmbeddedListContainer } from './containers/EmbeddedContainer';
import { ExternalFileContainer, ExternalListContainer } from './containers/ExternalContainer';
import { ExternalFileMultiContainer, ExternalListDailyContainer } from './containers/ExternalDirectoryContainer';
import { LinkContainer } from "./containers/LinkContainer";
import { ExternalFileLedgerContainer } from './containers/LedgerContainer';

export class ContainerFactory<T extends Container> {
    public static create(container_type: string, vault: Vault, name: string, meta?: any) {
        switch (container_type) {
            // Embedded Containers
            // -------------------
            case 'embedded_file':
                return new EmbeddedFileContainer(vault, name, meta);
            case 'embedded_list':
                return new EmbeddedListContainer(vault, name, meta);

            // External File Containers
            // ------------------------
            case 'external_file':
                return new ExternalFileContainer(vault, name, meta);
            case 'external_file_multi':
                return new ExternalFileMultiContainer(vault, name, meta);

            // External List Containers
            // ------------------------
            case 'external_list':
                return new ExternalListContainer(vault, name, meta);
            case 'external_list_daily':
                return new ExternalListDailyContainer(vault, name, meta);

            // Link Container
            case 'link':
                return new LinkContainer(vault, name, meta);

            // Ledger Container
            // ----------------
            case 'external_file_ledger':
                return new ExternalFileLedgerContainer(vault, name, meta);

            default:
                throw new Error(`Unknown Container type: '${container_type}'`);
        }
    }
}
