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
import React, { ChangeEvent, PureComponent } from 'react';
import {
  ActionMeta,
  LegacyForms,
  Monaco,
  ReactMonacoEditor,
  Select,
  monacoTypes,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorRow, EditorRows } from '@grafana/experimental';
import { AriaOpsDataSource } from '../datasource';
import { AriaOpsOptions, MyQuery } from '../types';
import { mapToSelectable } from 'utils';
import { monacoHighlighter } from 'queryparser/monaco/highlight';
import { buildTextQuery } from 'queryparser/processor';
import { AriaOpsCompletionItemProvider } from 'queryparser/monaco/completion';
import { debounce } from 'lodash';
import { LANG_ID } from 'queryparser/constants';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<AriaOpsDataSource, MyQuery, AriaOpsOptions>;

type State = {
  adapterKinds: Array<SelectableValue<string>>;
  resourceKinds: Array<SelectableValue<string>>;
  resources: Array<SelectableValue<string>>;
  metrics: Array<SelectableValue<string>>;
};

export class QueryEditor extends PureComponent<Props, State> {
  editor?: monacoTypes.editor.IStandaloneCodeEditor;

  constructor(props: Props) {
    super(props);
    this.state = {
      adapterKinds: [],
      resourceKinds: [],
      resources: [],
      metrics: [],
    };
    this.loadAdapterKindOptions();
    const { query } = this.props;
    if (query.adapterKind) {
      this.loadResourceKindOptions(query.adapterKind);
      if (query.resourceKind) {
        this.loadResourceOptions(query.adapterKind, query.resourceKind);
        this.loadMetricOptions(query.adapterKind, query.resourceKind);
      }
    }
  }

  onQueryTextChange = (content: string | undefined) => {
    const { onChange, query } = this.props;
    query.queryText = content;
    onChange({ ...query, queryText: content });
  };

  onResourceIdChange = (
    event: SelectableValue<string>,
    actionMeta: ActionMeta
  ) => {
    const { onChange, query } = this.props;
    onChange({
      ...query,
      resourceId: event.value || '',
      resourceName: event.label || '',
    });
  };

  onAdapterKindChange = (
    event: SelectableValue<string>,
    actionMeta: ActionMeta
  ) => {
    const { onChange, query } = this.props;
    this.loadResourceKindOptions(event.value || '');
    if (!query.advancedMode) {
      query.queryText = buildTextQuery(query);
    }
    onChange({ ...query, adapterKind: event.value || '' });
  };

  onResourceKindChange = (
    event: SelectableValue<string>,
    actionMeta: ActionMeta
  ) => {
    const { onChange, query } = this.props;
    if (query.adapterKind) {
      this.loadResourceOptions(query.adapterKind, event.value || '');
      this.loadMetricOptions(query.adapterKind, event.value || '');
    }
    onChange({ ...query, resourceKind: event.value || '' });
  };

  onMetricChange = (event: SelectableValue<string>, actionMeta: ActionMeta) => {
    const { onChange, query } = this.props;
    onChange({ ...query, metric: event.value || '' });
  };

  onAdvancedModeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    console.log(this.editor);
    const qt =
      event.target.checked && !query.queryText
        ? buildTextQuery(query)
        : query.queryText;
    onChange({ ...query, advancedMode: event.target.checked, queryText: qt });
  };

  loadResourceOptions(adapterKind: string, resourceKind: string) {
    this.props.datasource
      .getResources(adapterKind, resourceKind)
      .then((kinds) => {
        this.setState({ resources: mapToSelectable(kinds) });
      });
  }

  loadResourceKindOptions(adapterKind: string) {
    this.props.datasource.getResourceKinds(adapterKind).then((kinds) => {
      this.setState({ resourceKinds: mapToSelectable(kinds) });
    });
  }

  loadMetricOptions(adapterKind: string, resourceKind: string) {
    this.props.datasource
      .getStatKeysForResourceKind(adapterKind, resourceKind)
      .then((kinds) => {
        const s: Array<SelectableValue<string>> = [];
        for (let [key, value] of kinds) {
          s.push({ value: key, label: key + ': ' + value });
        }
        s.sort((a, b) =>
          (a.label || '').toLocaleLowerCase() >
          (b.label || '').toLocaleLowerCase()
            ? 1
            : -1
        );
        this.setState({ metrics: s });
      });
  }

  loadAdapterKindOptions() {
    this.props.datasource.getAdapterKinds().then((kinds) => {
      const s = mapToSelectable(kinds);
      s.sort((a, b) =>
        (a.label || '').toLocaleLowerCase() >
        (b.label || '').toLocaleLowerCase()
          ? 1
          : -1
      );
      this.setState({ adapterKinds: s });
    });
  }

  onMonacoMount = (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    if (!monaco.languages.getLanguages().some((lang) => lang.id === LANG_ID)) {
      monaco.languages.register({ id: LANG_ID });
      monaco.languages.setMonarchTokensProvider(LANG_ID, monacoHighlighter);
      monaco.languages.registerCompletionItemProvider(
        LANG_ID,
        new AriaOpsCompletionItemProvider(this.props.datasource, monaco)
      );
    }
  };

  render() {
    const {
      resourceId,
      metric,
      adapterKind,
      resourceKind,
      queryText,
      advancedMode,
    } = this.props.query;

    return (
      <div className="gf-form">
        <EditorRows>
          <EditorRow>
            <Select
              width={30}
              placeholder="Choose Adapter Kind..."
              onChange={this.onAdapterKindChange}
              value={adapterKind}
              options={this.state.adapterKinds}
            />
            <Select
              width={30}
              placeholder="Choose Resource Kind..."
              onChange={this.onResourceKindChange}
              value={resourceKind}
              options={this.state.resourceKinds}
            />
            <Select
              width={30}
              placeholder="Choose Resource..."
              onChange={this.onResourceIdChange}
              value={resourceId}
              options={this.state.resources}
            />
            <Select
              width={30}
              placeholder="Choose Metric..."
              onChange={this.onMetricChange}
              value={metric}
              options={this.state.metrics}
            />
            <FormField
              label="Advanced mode"
              labelWidth={10}
              inputWidth={10}
              onChange={this.onAdvancedModeChange}
              checked={advancedMode}
              placeholder="Advanced Mode"
              type="checkbox"
            />
          </EditorRow>
          <EditorRow>
            <ReactMonacoEditor
              onChange={debounce(this.onQueryTextChange, 300)}
              value={queryText}
              height={200}
              onMount={this.onMonacoMount}
              language="aria-operations"
              options={{ readOnly: !advancedMode }}
            />
          </EditorRow>
        </EditorRows>
      </div>
    );
  }
}
