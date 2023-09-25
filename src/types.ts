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

export interface AriaOpsQuery extends DataQuery {
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

export const defaultQuery: Partial<AriaOpsQuery> = {
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
  parameter?: number;
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
