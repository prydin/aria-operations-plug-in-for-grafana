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
import { Monaco, ReactMonacoEditor, monacoTypes } from '@grafana/ui';
import { AriaOpsDataSource } from 'datasource';
import { debounce } from 'lodash';
import { LANG_ID } from 'queryparser/constants';
import { AriaOpsCompletionItemProvider } from 'queryparser/monaco/completion';
import { monacoHighlighter } from 'queryparser/monaco/highlight';
import React, { PureComponent } from 'react';

// type Props = QueryEditorProps<AriaOpsDataSource, AriaOpsQuery, AriaOpsOptions>;

export interface SimlpeQuery {
  queryText?: string;
}

interface Props {
  datasource: AriaOpsDataSource;
  query: SimlpeQuery;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export class QueryTextEditor extends PureComponent<Props> {
  editor?: monacoTypes.editor.IStandaloneCodeEditor;

  constructor(props: Props) {
    super(props);
  }

  onMonacoMount = (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editor.onDidBlurEditorWidget(this.onBlur);
    if (!monaco.languages.getLanguages().some((lang) => lang.id === LANG_ID)) {
      monaco.languages.register({ id: LANG_ID });
      monaco.languages.setMonarchTokensProvider(LANG_ID, monacoHighlighter);
      monaco.languages.registerCompletionItemProvider(
        LANG_ID,
        new AriaOpsCompletionItemProvider(this.props.datasource, monaco)
      );
    }
  };

  onQueryTextChange = (content: string | undefined) => {
    const { onChange } = this.props;
    this.props.query.queryText = content;
    onChange(content || '');
  };

  onBlur = (e: any) => {
    if (this.props.onBlur) {
      console.log('eeeee', e);
      this.props.onBlur();
    }
  };

  render() {
    return (
      <ReactMonacoEditor
        onChange={debounce(this.onQueryTextChange, 300)}
        value={this.props.query.queryText}
        height={200}
        onMount={this.onMonacoMount}
        language="aria-operations"
      />
    );
  }
}
