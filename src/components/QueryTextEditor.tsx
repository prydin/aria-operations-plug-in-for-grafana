import { EditorRow, EditorRows } from '@grafana/experimental';
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
