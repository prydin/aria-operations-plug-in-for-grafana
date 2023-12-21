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
  AriaOpsQuery,
  ResourceRequest,
  KeyValue,
  FilterSpec,
  Condition,
  CompiledQuery,
  AggregationSpec,
  SlidingWindowSpec,
} from '../types';

// The generated parser is pure JavaScript, so we need to be a little lax on our linting.
//
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */

const parser = require('./parser'); /* eslint-disable-line @typescript-eslint/no-var-requires */

export const makeFilter = (args: any): FilterSpec => {
  const spec: FilterSpec = {
    conditions: [],
  };

  for (const p of args) {
    if (p.conjunctive) {
      if (
        spec.conjunctionOperator &&
        p.conjunctive.toUpperCase() !== spec.conjunctionOperator
      ) {
        throw `All terms must have the same conjunctive operator (and/or). Offending operator: ${
          p.conjunctive as string
        }`;
      }
      spec.conjunctionOperator = p.conjunctive.toUpperCase();
    }
    const c: Condition = {
      operator: p.name,
      key: p.arg[0],
    };
    if (p.arg.length > 1) {
      const v = p.arg[1];
      if (typeof v === 'number') {
        c.doubleValue = v;
      } else {
        c.stringValue = v;
      }
    }
    spec.conditions.push(c);
  }
  if (!spec.conjunctionOperator) {
    spec.conjunctionOperator = 'AND';
  }
  return spec;
};

export const compileQuery = (query: AriaOpsQuery): CompiledQuery => {
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

  type Resolver = (args: any) => void;

  const resolvers: KeyValue<Resolver> = {
    all: (
      args: /* eslint-disable-line @typescript-eslint/no-unused-vars */ any
    ) => {
      // Empty
    },
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
    const pq = parser.parse(query.queryText);

    /// Handle type
    const types: string[] = pq.type;
    for (const type of types) {
      const parts = type.split(':');
      resourceQuery.adapterKind?.push(parts[0]);
      resourceQuery.resourceKind?.push(parts[1]);
    }

    // Handle instance filters by calling the resolver functions
    const seenBefore = new Set<string>();
    for (const predicate of pq.instances) {
      if (seenBefore.has(predicate.type)) {
        throw `Each filter is only allowed once. Offending filter: ${predicate.type}`;
      }
      seenBefore.add(predicate.type);
      resolvers[predicate.type as string](predicate.arg);
    }

    // Handle metrics
    if (!pq.metrics) {
      throw 'Missing .metrics() clause';
    }
    const metrics = pq.metrics;

    // Handle aggregations and sliding windows
    const aggregation: AggregationSpec = pq.aggregation;
    const slidingWindow: SlidingWindowSpec = pq.slidingWindow;
    return { resourceQuery, metrics, aggregation, slidingWindow };
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

export const buildTextQuery = (query: AriaOpsQuery): string => {
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
