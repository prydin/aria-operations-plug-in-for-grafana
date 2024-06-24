/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the 
Aria Operations plug-in for Grafana project. You may not use this file except 
in compliance with the License.

BSD-2 License

Redistribution and use in source and binary forms, with or without 
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, 
this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or 
other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, 
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { AriaOpsDataSource } from 'datasource';
import type { Monaco, monacoTypes } from '@grafana/ui';
import { KEYWORDS } from 'queryparser/constants';
import { KeyValue } from 'types';

const STATES = [
  'STOPPED',
  'STARTING',
  'STARTED',
  'STOPPING',
  'UPDATING',
  'FAILED',
  'MAINTAINED',
  'MAINTAINED_MANUAL',
  'REMOVING',
  'NOT_EXISTING',
  'NONE',
  'UNKNOWN',
];

const STATUSES = [
  'NONE',
  'ERROR',
  'UNKNOWN',
  'DOWN',
  'DATA_RECEIVING',
  'OLD_DATA_RECEIVING',
  'NO_DATA_RECEIVING',
  'NO_PARENT_MONITORING',
  'COLLECTOR_DOWN',
];

const HEALTH = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'GREY'];

type Tuple = [string, string];

type HandlerFunction = (
  text: string,
  range: monacoTypes.IRange
) => monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList>;

export class AriaOpsCompletionItemProvider
  implements monacoTypes.languages.CompletionItemProvider
{
  datasource: AriaOpsDataSource;
  monaco: Monaco;
  resourceKinds?: string[];
  metricNameCache: Map<string, Tuple[]> = new Map();
  propertyNameCache: Map<string, Tuple[]> = new Map();
  triggerCharacters?: string[];

  constructor(datasource: AriaOpsDataSource, monaco: Monaco) {
    this.datasource = datasource;
    this.monaco = monaco;
    if (!this.resourceKinds || this.resourceKinds.length === 0) {
      this.preLoadResourceTypes();
    }
  }

  private preLoadResourceTypes() {
    const buffer: string[] = [];
    void this.datasource
      .getAdapterKinds()
      .then((adapterKinds: Map<string, string>) => {
        for (const adapterKind of adapterKinds.keys()) {
          this.datasource
            .getResourceKinds(adapterKind)
            .then((resourceKinds) => {
              for (const resourceKind of resourceKinds.keys()) {
                buffer.push(adapterKind + ':' + resourceKind);
              }
            })
            .catch(
              (adapterKind: string) =>
                console.log('Could not load resource kinds for ') + adapterKind
            );
        }
      });
    this.resourceKinds = buffer;
  }

  /**
   * Tries to match a string starting with 'resource(...)' and assumes that
   * what's within the parameters is a resorce type.
   * @param text
   * @returns
   */
  private inferResourceType(text: string): string {
    const match = text.match(/\s*resource\(([^)]+)/);
    if (!match) {
      return '';
    }
    return match.at(1) || '';
  }

  // Context aware handlers. Each handler tries to infer the best completion choices based on its context.
  private handleMetric = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    const type = this.inferResourceType(text);
    const cached = this.metricNameCache.get(type);
    if (cached) {
      return Promise.resolve({
        suggestions: cached.map((m: Tuple) =>
          this.makeCompletionItem(m[0], range, m[1])
        ),
      });
    }
    return new Promise(
      (
        resolve,
        /* eslint-disable-line @typescript-eslint/no-unused-vars */ reject
      ) => {
        const tuple = type.split(':');
        void this.datasource
          .getStatKeysForResourceKind(tuple[0], tuple[1])
          .then((metrics) => {
            const suggestions = [];
            for (const key in metrics) {
              suggestions.push(
                this.makeCompletionItem(key, range, metrics.get(key))
              );
            }
            this.metricNameCache.set(type, [...metrics.entries()]);
            resolve({ suggestions });
          });
      }
    );
  };

  private handleProperty = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    const type = this.inferResourceType(text);
    const cached = this.propertyNameCache.get(type);
    if (cached) {
      return Promise.resolve({
        suggestions: cached.map((p) =>
          this.makeCompletionItem(p[0], range, p[1])
        ),
      });
    }
    return new Promise(
      (
        resolve,
        /* eslint-disable-line @typescript-eslint/no-unused-vars */ reject
      ) => {
        const tuple = type.split(':');
        void this.datasource
          .getPropertiesForResourceKind(tuple[0], tuple[1])
          .then((properties) => {
            const suggestions = [];
            for (const key in properties) {
              suggestions.push(
                this.makeCompletionItem(key, range, properties.get(key))
              );
            }
            this.propertyNameCache.set(type, [...properties.entries()]);
            resolve({ suggestions });
          });
      }
    );
  };

  private handleResource = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions:
        this.resourceKinds?.map((label) =>
          this.makeCompletionItem(label, range)
        ) || [],
    };
  };

  private handleHelth = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions:
        HEALTH.map((label) => this.makeCompletionItem(label, range)) || [],
    };
  };

  private handleState = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions:
        STATES.map((label) => this.makeCompletionItem(label, range)) || [],
    };
  };

  private handleStatus = (
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions:
        STATUSES.map((label) => this.makeCompletionItem(label, range)) || [],
    };
  };

  private handleDefault = (
    text: string /* eslint-disable-line @typescript-eslint/no-unused-vars */,
    range: monacoTypes.IRange /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions: [],
    };
  };

  /**
   * Each keyword carries a hint on how to handle the parameters.
   */
  keywords: KeyValue<HandlerFunction> = {
    resource: this.handleResource,
    whereMetrics: this.handleMetric,
    whereProperties: this.handleProperty,
    whereHealth: this.handleHelth,
    whereState: this.handleState,
    whereStatus: this.handleStatus,
    metrics: this.handleMetric,
    id: this.handleDefault,
    name: this.handleDefault,
    regex: this.handleDefault,
    avg: this.handleProperty,
    sum: this.handleProperty,
    min: this.handleProperty,
    max: this.handleProperty,
    stddev: this.handleProperty,
    count: this.handleProperty,
    variance: this.handleProperty,
    percentile: this.handleProperty,
  };

  private makeCompletionItem(
    label: string,
    range: monacoTypes.IRange,
    detail?: string
  ): monacoTypes.languages.CompletionItem {
    return {
      label,
      range,
      detail,
      insertText: label.includes(' ') ? '"' + label + '"' : label, // Quote strings containing spaces
      kind: this.monaco.languages.CompletionItemKind.Function,
    };
  }

  provideCompletionItems(
    model: monacoTypes.editor.ITextModel,
    position: monacoTypes.Position,
    context: monacoTypes.languages.CompletionContext /* eslint-disable-line @typescript-eslint/no-unused-vars */,
    token: monacoTypes.CancellationToken /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> {
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // We need some custom word matching due to "funny" characters like | and : in names.
    const match = textUntilPosition.match(/([A-Za-z0-9_$:|]+)$/);
    if (!match) {
      return { suggestions: [] };
    }
    const word = {
      word: match[1],
      endColumn: position.column,
      startColumn: position.column - match[1].length,
    };
    const range: monacoTypes.IRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    // Are we expecting the name of a filter?
    if (
      textUntilPosition.match(/\)\s*\.\s*[^()]*$/) ||
      textUntilPosition.match(/^\s*[^()]*$/)
    ) {
      const suggestions = KEYWORDS.map((k: string) =>
        this.makeCompletionItem(k, range)
      );
      return { suggestions };
    }

    // Assume we're inside a filter declaration. We pick the one that's closest to the cursor looking backwards.
    let bestPos = -1;
    let bestHandler = null;
    for (const key in this.keywords) {
      const p = textUntilPosition.lastIndexOf(key);
      if (p > bestPos) {
        bestPos = p;
        bestHandler = this.keywords[key];
      }
    }
    if (!bestHandler) {
      return { suggestions: [] };
    }

    return bestHandler(textUntilPosition, range);
  }

  resolveCompletionItem?(
    item: monacoTypes.languages.CompletionItem /* eslint-disable-line @typescript-eslint/no-unused-vars */,
    token: monacoTypes.CancellationToken /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionItem> {
    return null;
  }
}
