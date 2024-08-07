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
  Select,
  monacoTypes,
  InputActionMeta,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorRow, EditorRows } from '@grafana/experimental';
import { AriaOpsDataSource } from '../datasource';
import { AriaOpsOptions, AriaOpsQuery } from '../types';
import { mapToSelectable } from 'utils';
import { buildTextQuery } from 'queryparser/compiler';
import { debounce } from 'lodash';
import { QueryTextEditor } from './QueryTextEditor';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<AriaOpsDataSource, AriaOpsQuery, AriaOpsOptions>;

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
    actionMeta: ActionMeta /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ) => {
    const { onChange, query } = this.props;
    onChange({
      ...query,
      resourceId: event.value || '',
      resourceName: event.label || '',
    });
  };

  onResourceInputChange = (
    value: string,
    actionMeta: InputActionMeta /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ) => {
    const { query } = this.props;
    if (query.adapterKind && query.resourceKind) {
      this.loadResourceOptions(query.adapterKind, query.resourceKind, value);
    }
  };

  onAdapterKindChange = (
    event: SelectableValue<string>,
    actionMeta: ActionMeta /* eslint-disable-line @typescript-eslint/no-unused-vars */
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
    actionMeta: ActionMeta /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ) => {
    const { onChange, query } = this.props;
    if (query.adapterKind) {
      this.loadResourceOptions(query.adapterKind, event.value || '');
      this.loadMetricOptions(query.adapterKind, event.value || '');
    }
    onChange({ ...query, resourceKind: event.value || '' });
  };

  onMetricChange = (
    event: SelectableValue<string>,
    actionMeta: ActionMeta /* eslint-disable-line @typescript-eslint/no-unused-vars */
  ) => {
    const { onChange, query } = this.props;
    onChange({ ...query, metric: event.value || '' });
  };

  onAdvancedModeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    const qt =
      event.target.checked && !query.queryText
        ? buildTextQuery(query)
        : query.queryText;
    onChange({ ...query, advancedMode: event.target.checked, queryText: qt });
  };

  loadResourceOptions(
    adapterKind: string,
    resourceKind: string,
    name?: string
  ) {
    void this.props.datasource
      .getResources(adapterKind, resourceKind, name)
      .then((kinds) => {
        this.setState({ resources: mapToSelectable(kinds) });
      });
  }

  loadResourceKindOptions(adapterKind: string) {
    void this.props.datasource.getResourceKinds(adapterKind).then((kinds) => {
      this.setState({ resourceKinds: mapToSelectable(kinds) });
    });
  }

  loadMetricOptions(adapterKind: string, resourceKind: string) {
    void this.props.datasource
      .getStatKeysForResourceKind(adapterKind, resourceKind)
      .then((kinds) => {
        const s: Array<SelectableValue<string>> = [];
        for (const [key, value] of kinds) {
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
    void this.props.datasource.getAdapterKinds().then((kinds) => {
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

  render() {
    const props = this.props;
    const {
      resourceId,
      metric,
      adapterKind,
      resourceKind,
      queryText,
      advancedMode,
    } = props.query;

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
              disabled={this.state.adapterKinds.length === 0}
            />
            <Select
              width={30}
              placeholder="Choose Resource Kind..."
              onChange={this.onResourceKindChange}
              value={resourceKind}
              options={this.state.resourceKinds}
              disabled={this.state.resourceKinds.length === 0}
            />
            <Select
              width={30}
              placeholder="Choose Resource..."
              onChange={this.onResourceIdChange}
              value={resourceId}
              options={this.state.resources}
              onInputChange={debounce(this.onResourceInputChange, 300)}
              disabled={this.state.resources.length === 0}
            />
            <Select
              width={30}
              placeholder="Choose Metric..."
              onChange={this.onMetricChange}
              value={metric}
              options={this.state.metrics}
              disabled={this.state.metrics.length === 0}
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
            <QueryTextEditor
              datasource={this.props.datasource}
              query={{ queryText }}
              onChange={this.onQueryTextChange}
              advancedMode={advancedMode}
            />
          </EditorRow>
        </EditorRows>
      </div>
    );
  }
}
