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
    this.datasource.getAdapterKinds().then((adapterKinds) => {
      for (let adapterKind of adapterKinds.keys()) {
        this.datasource
          .getResourceKinds(adapterKind)
          .then((resourceKinds) => {
            for (let resourceKind of resourceKinds.keys()) {
              buffer.push(adapterKind + ':' + resourceKind);
            }
          })
          .catch(
            (adapterKind) =>
              console.log('Could not load resource kinds for ') + adapterKind
          );
      }
    });
    this.resourceKinds = buffer;
  }

  private inferResourceType(text: string): string {
    const match = text.match(/\s*resource\(([^)]+)/);
    if (!match) {
      return '';
    }
    return match.at(1) || '';
  }

  private handleMetric = (
    text: string,
    range: any
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    const type = this.inferResourceType(text);
    const cached = this.metricNameCache.get(type);
    if (cached) {
      return Promise.resolve({
        suggestions: cached!.map((m) =>
          this.makeCompletionItem(m[0], range, m[1])
        ),
      });
    }
    return new Promise((resolve, reject) => {
      const tuple = type.split(':');
      this.datasource
        .getStatKeysForResourceKind(tuple[0], tuple[1])
        .then((metrics) => {
          const suggestions = [];
          for (let key in metrics) {
            suggestions.push(
              this.makeCompletionItem(key, range, metrics.get(key))
            );
          }
          this.metricNameCache.set(type, [...metrics.entries()]);
          resolve({ suggestions });
        });
    });
  };

  private handleProperty = (
    text: string,
    range: any
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    const type = this.inferResourceType(text);
    const cached = this.propertyNameCache.get(type);
    if (cached) {
      return Promise.resolve({
        suggestions: cached!.map((p) =>
          this.makeCompletionItem(p[0], range, p[1])
        ),
      });
    }
    return new Promise((resolve, reject) => {
      const tuple = type.split(':');
      this.datasource
        .getPropertiesForResourceKind(tuple[0], tuple[1])
        .then((properties) => {
          const suggestions = [];
          for (let key in properties) {
            suggestions.push(
              this.makeCompletionItem(key, range, properties.get(key))
            );
          }
          this.propertyNameCache.set(type, [...properties.entries()]);
          resolve({ suggestions });
        });
    });
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
    text: string,
    range: monacoTypes.IRange
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> => {
    return {
      suggestions: [],
    };
  };

  keywords: KeyValue = {
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
      insertText: label,
      kind: this.monaco.languages.CompletionItemKind.Function,
    };
  }

  provideCompletionItems(
    model: monacoTypes.editor.ITextModel,
    position: monacoTypes.Position,
    context: monacoTypes.languages.CompletionContext,
    token: monacoTypes.CancellationToken
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
    for (let key in this.keywords) {
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
    item: monacoTypes.languages.CompletionItem,
    token: monacoTypes.CancellationToken
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionItem> {
    return null;
  }
}
