import { DataSourcePlugin } from '@grafana/data';
import { AriaOpsDataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { MyQuery, AriaOpsOptions } from './types';

export const plugin = new DataSourcePlugin<
  AriaOpsDataSource,
  MyQuery,
  AriaOpsOptions
>(AriaOpsDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
