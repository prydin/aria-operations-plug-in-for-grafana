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

import {
  MyQuery,
  ResourceRequest,
  KeyValue,
  FilterSpec,
  Condition,
  CompiledQuery,
  AggregationSpec,
} from '../types';

let parser = require('./parser');

export const makeFilter = (args: any): FilterSpec => {
  const spec: FilterSpec = {
    conditions: [],
  };

  for (let p of args) {
    if (p.conjuctive) {
      if (
        spec.conjunctionOperator &&
        p.conjuctive.toUpperCase() !== spec.conjunctionOperator
      ) {
        throw (
          'All terms must have the same conjuctive operator (and/or). Offending operator: ' +
          p.conjuctive
        );
      }
      spec.conjunctionOperator = p.conjuctive.toUpperCase();
    }
    const c: Condition = {
      operator: p.name,
      key: p.arg[0],
    };
    if (p.arg.length > 1) {
      const v = p.arg[1];
      if (typeof v === 'number') {
        c.doubleValue = v as number;
      } else {
        c.stringValue = v as string;
      }
    }
    if (!spec.conjunctionOperator) {
      spec.conjunctionOperator = 'AND';
    }
    spec.conditions.push(c);
  }
  return spec;
};

export const compileQuery = (query: MyQuery): CompiledQuery => {
  const resourceQuery: ResourceRequest = {
    adapterKind: [],
    regex: [],
    name: [],
    resourceId: [],
    resourceKind: [],
    resourceState: [],
    resourceHealth: [],
    resourceStatus: [],
  };
  const resolvers: KeyValue = {
    all: (args: any) => {},
    regex: (args: any) => {
      resourceQuery.regex = args;
    },
    name: (args: any) => {
      resourceQuery.name = args;
    },
    id: (args: any) => {
      resourceQuery.resourceId = args;
    },
    whereProperties: (args: any) => {
      resourceQuery.propertyConditions = makeFilter(args);
    },
    whereMetrics: (args: any) => {
      console.log('whereMetrics: ' + args);
      resourceQuery.statConditions = makeFilter(args);
    },
    whereHealth: (args: any) => {
      resourceQuery.resourceHealth = args;
    },
    whereState: (args: any) => {
      resourceQuery.resourceState = args;
    },
    whereStatus: (args: any) => {
      resourceQuery.resourceStatus = args;
    },
    whereTags: (args: any) => {
      resourceQuery.resourceTag = args.map((tag: string) => {
        const parts = tag.split(':');
        if (parts.length !== 2) {
          throw 'Tags nust be specified on the form category:name';
        }
        return { category: parts[0], name: parts[1] };
      });
    },
  };
  if (query.advancedMode) {
    let pq = parser.parse(query.queryText);
    console.log(pq);

    /// Handle type
    let types: string[] = pq.type;
    for (let type of types) {
      let parts = type.split(':');
      resourceQuery.adapterKind?.push(parts[0]);
      resourceQuery.resourceKind?.push(parts[1]);
    }

    // Handle instance filters by calling the resolver functions
    const seenBefore = new Set<string>();
    console.log(pq.instances);
    for (let predicate of pq.instances) {
      if (seenBefore.has(predicate)) {
        throw (
          'Each filter is only allowed once. Offending filter: ' + predicate
        );
      }
      seenBefore.add(predicate);
      console.log('Pred: ' + JSON.stringify(predicate));
      resolvers[predicate.type as string](predicate.arg);
    }

    // Handle metrics
    if (!pq.metrics) {
      throw 'Missing .metrics() clause';
    }
    const metrics = pq.metrics;

    // Handle aggregations
    const aggregation: AggregationSpec = pq.aggregation;
    return { resourceQuery, metrics, aggregation };
  } else {
    if (!query.resourceId) {
      throw 'No resource specified';
    }
    const resourceId = [query.resourceId];
    const resourceQuery = { resourceId };
    if (!query.metric) {
      throw 'No metric specified';
    }
    const metrics: string[] = [query.metric];
    return { resourceQuery, metrics };
  }
};

export const buildTextQuery = (query: MyQuery): string => {
  let s = '';
  if (query.adapterKind && query.resourceKind) {
    s += 'resource(' + query.adapterKind + ':' + query.resourceKind + ')';
  }
  if (query.resourceName) {
    s += '.name("' + query.resourceName + '")';
  }
  if (query.metric) {
    s += '.metrics(' + query.metric + ')';
  }
  return s;
};
