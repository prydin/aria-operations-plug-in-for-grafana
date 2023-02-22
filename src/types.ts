import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface AriaOpsOptions extends DataSourceJsonData {
  host: string;
  username: string;
  authSource: string;
  tlsSkipVerify: boolean;
}

export interface MySecureJsonData {
  password: string;
}

export interface MyQuery extends DataQuery {
  adapterKind?: string;
  resourceKind?: string;
  resourceId?: string;
  resourceName?: string;
  metric?: string;
  queryText?: string;
  advancedMode: boolean;
}

export const defaultOptions: Partial<AriaOpsOptions> = {
  authSource: 'Local Users',
};

export const defaultQuery: Partial<MyQuery> = {
  resourceName: '',
  resourceKind: '',
  adapterKind: '',
  resourceId: '',
  metric: '',
};

export interface Condition {
  doubleValue?: number;
  stringValue?: string;
  key: string;
  operator: string;
}

export interface FilterSpec {
  conditions: Condition[];
  conjunctionOperator?: string;
}

export interface TagSpec {
  category: string;
  name?: string;
}

export interface ResourceRequest {
  adapterKind?: string[];
  resourceKind?: string[];
  resourceId?: string[];
  regex?: string[];
  name?: string[];
  id?: string[];
  propertyConditions?: FilterSpec;
  statConditions?: FilterSpec;
  resourceState?: string[];
  resourceStatus?: string[];
  resourceHealth?: string[];
  resourceTag?: TagSpec[];
}

export interface AggregationSpec {
  type: string;
  properties: string[];
}

export interface CompiledQuery {
  resourceQuery: ResourceRequest;
  metrics: string[];
  aggregation?: AggregationSpec;
}

export interface KeyValue {
  [key: string]: any;
}
