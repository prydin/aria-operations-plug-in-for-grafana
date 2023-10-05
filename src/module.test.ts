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

import { Stats } from 'aggregator';
import { fill } from 'lodash';
import { compileQuery } from 'queryparser/compiler';
import {
  SlidingAverage,
  SlidingMax,
  SlidingMedian,
  SlidingMin,
  SlidingStdDev,
  SlidingSum,
  SortedBag,
  estimateBandwidth,
  lambertW,
} from 'sliding';
import { AggregationSpec, CompiledQuery, SlidingWindowSpec } from 'types';

const aggregations = [
  'avg',
  'sum',
  'count',
  'max',
  'min',
  'variance',
  'stddev',
];

const slidingWindows = [
  'mavg',
  'msum',
  'mmax',
  'mmin',
  'mmedian',
  'mstddev',
  'mvariance',
];

const data = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const aggResults = [5, 45, 9, 9, 1, 7.5, Math.sqrt(7.5)];

const simpleAllQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleNameQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: ['myVm'],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleRegexQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: ['\\smyVm\\s'],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWherePropertiesQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
    propertyConditions: {
      conditions: [
        { key: 'foo', operator: 'EQ', stringValue: 'bar' },
        { key: 'bar', operator: 'EQ', stringValue: 'foo' },
      ],
      conjunctionOperator: 'AND',
    },
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const negatedWherePropertiesQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
    propertyConditions: {
      conditions: [{ key: 'foo', operator: 'NOT_EXISTS' }],
      conjunctionOperator: 'AND',
    },
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWhereMetricsQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
    statConditions: {
      conditions: [
        { key: 'foo', operator: 'EQ', stringValue: 'bar' },
        { key: 'bar', operator: 'EQ', stringValue: 'foo' },
      ],
      conjunctionOperator: 'OR',
    },
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWhereHealthQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: ['RED'],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWhereStateQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: ['RUNNING'],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWhereStatusQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: ['RUNNING'],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleWhereTagsQueryResult: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
    resourceTag: [{ category: 'foo', name: 'bar' }],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const aggregationResultTemplate: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: null as any,
};

const simpleSlidingWindowSpec: SlidingWindowSpec = {
  type: 'mavg',
  duration: 0,
};

const slidingWindowResultTemplate: CompiledQuery = {
  resourceQuery: {
    adapterKind: ['VMWARE'],
    name: [],
    regex: [],
    resourceHealth: [],
    resourceId: [],
    resourceKind: ['VirtualMachine'],
    resourceState: [],
    resourceStatus: [],
  },
  metrics: ['cpu|demandmhz'],
  aggregation: null as any,
  slidingWindow: simpleSlidingWindowSpec,
};

const simpleAggregationSpec: AggregationSpec = {
  type: 'avg',
  parameter: 50.0,
  properties: [],
};

const testCompile = (queryText: string): CompiledQuery => {
  return compileQuery({ queryText, advancedMode: true, refId: 'dummy' });
};

describe('Query parser', () => {
  test('Simple all()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleAllQueryResult);
  });

  test('Simple name()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).name("myVm").metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleNameQueryResult);
  });

  test('Simple regex()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).regex("\\smyVm\\s").metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleRegexQueryResult);
  });

  test('Simple whereProperties()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereProperties(foo = "bar" and bar = "foo").metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWherePropertiesQueryResult);
  });

  test('Negated whereProperties()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereProperties(not exists(foo)).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(negatedWherePropertiesQueryResult);
  });

  test('Illegal whereProperties()', () => {
    const q = () => {
      testCompile(
        'resource(VMWARE:VirtualMachine).whereProperties(foo = "bar" and bar = "foo" or fizz = "buzz").metrics(cpu|demandmhz)'
      );
    };
    expect(q).toThrowError();
  });

  test('Simple whereMetrics()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereMetrics(foo = "bar" or bar = "foo").metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereMetricsQueryResult);
  });

  test('Illegal whereMetrics()', () => {
    const q = () => {
      testCompile(
        'resource(VMWARE:VirtualMachine).whereMetrics(foo = "bar" and bar = "foo" or fizz = "buzz").metrics(cpu|demandmhz)'
      );
    };
    expect(q).toThrowError();
  });

  test('Simple whereHealth()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereHealth(RED).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereHealthQueryResult);
  });

  test('Simple whereState()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereState(RUNNING).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereStateQueryResult);
  });

  test('Simple whereStatus()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereStatus(RUNNING).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereStatusQueryResult);
  });

  test('Simple whereStatus()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereStatus(RUNNING).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereStatusQueryResult);
  });

  test('Simple whereTags()', () => {
    const q = testCompile(
      'resource(VMWARE:VirtualMachine).whereTags(foo:bar).metrics(cpu|demandmhz)'
    );
    expect(q).toStrictEqual(simpleWhereTagsQueryResult);
  });

  test('Simple aggregation', () => {
    for (const aggregation of aggregations) {
      const q = testCompile(
        `resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz).${aggregation}()`
      );
      aggregationResultTemplate.aggregation = {
        type: aggregation,
        properties: null as any,
      };
      expect(q).toStrictEqual(aggregationResultTemplate);
    }
  });

  test('Simple sliding window', () => {
    for (const timeunit of [
      ['s', 1],
      ['m', 60],
      ['h', 3600],
      ['d', 86400],
      ['w', 7 * 86400],
      ['y', 365 * 86400],
    ]) {
      for (const sw of slidingWindows) {
        const q = testCompile(
          `resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz).${sw}(7${timeunit[0]})`
        );
        slidingWindowResultTemplate.slidingWindow = {
          type: sw,
          duration: 7 * (timeunit[1] as number),
        };
        expect(q).toStrictEqual(slidingWindowResultTemplate);
      }
    }
  });

  test('Aggregation with properties', () => {
    for (const aggregation of aggregations) {
      const q = testCompile(
        `resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz).${aggregation}(foo, bar)`
      );
      aggregationResultTemplate.aggregation = {
        type: aggregation,
        properties: ['foo', 'bar'],
      };
      expect(q).toStrictEqual(aggregationResultTemplate);
    }
  });
});

describe('Aggregations', () => {
  for (const agg in aggregations) {
    test(aggregations[agg], () => {
      simpleAggregationSpec.type = aggregations[agg];
      const s = new Stats(simpleAggregationSpec);
      for (let i = 0; i < 10; ++i) {
        s.add(fill(Array(data.length), i), data, new Map());
        for (const frame of s.toFrames('dummy', simpleAggregationSpec, null)) {
          expect(frame.fields[1].values.get(0)).toBe(aggResults[agg]);
        }
      }
    });
  }
});

describe('Sliced aggregations', () => {
  const key = new Map([
    ['foo', 'bar'],
    ['bar', 'foo'],
  ]);
  for (const agg in aggregations) {
    test(aggregations[agg], () => {
      simpleAggregationSpec.type = aggregations[agg];
      const s = new Stats(simpleAggregationSpec);
      for (let i = 0; i < 10; ++i) {
        s.add(fill(Array(data.length), i), data, key);
        for (const frame of s.toFrames('dummy', simpleAggregationSpec, null)) {
          const f = frame.fields[1];
          expect(f.labels!['foo']).toBe('bar');
          expect(f.labels!['bar']).toBe('foo');
          expect(f.values.get(0)).toBe(aggResults[agg]);
        }
      }
    });
  }
});

describe('Simple percentile', () => {
  test('Percentile', () => {
    const q = testCompile(
      `resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz).percentile(90, foo, bar)`
    );
    expect(q.aggregation?.type).toBe('percentile');
    expect(q.aggregation?.parameter).toBe(90);
    expect(q.aggregation?.properties).toStrictEqual(['foo', 'bar']);
  });
});

function seqSum(x: number) {
  return (x * (x + 1)) / 2;
}

describe('Sliding functions', () => {
  test('Average', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingAverage(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue()).toBe(i / 2);
      } else {
        expect(acc.getValue()).toBe((2 * i - duration + 1) / 2);
      }
    }
  });
  test('Sum', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingSum(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue()).toBe(seqSum(i));
      } else {
        expect(acc.getValue()).toBe(seqSum(i) - seqSum(i - duration));
      }
    }
  });
  test('Max toggle', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMax(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i * 2, i);
      acc.push(i * 2 + 1, -i);
      expect(acc.getValue()).toBe(i);
    }
  });

  test('Max backwards', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMax(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, -i);
      if (i < duration) {
        expect(acc.getValue()).toBe(-0);
      } else {
        expect(acc.getValue()).toBe(duration - i - 1);
      }
    }
  });

  test('Min toggle', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMin(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i * 2, i);
      acc.push(i * 2 + 1, -i);
      expect(acc.getValue()).toBe(-i);
    }
  });

  test('Min backwards', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMin(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue()).toBe(0);
      } else {
        expect(acc.getValue()).toBe(i - duration + 1);
      }
    }
  });

  const stddev = [
    0, 0.707106781, 1, 1.290994449, 1.58113883, 1.870828693, 2.160246899,
    2.449489743, 2.738612788, 3.027650354,
  ];

  test('StdDev', () => {
    const n = 20;
    const duration = 10;
    const acc = new SlidingStdDev(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue()).toBeCloseTo(stddev[i], 6);
      } else {
        expect(acc.getValue()).toBeCloseTo(stddev[stddev.length - 1], 6);
      }
    }
  });

  const sequence = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 9];

  test('SortedBag', () => {
    const bag = new SortedBag(false);
    sequence.forEach((x) => bag.push(x));
    expect(bag.size).toBe(sequence.length);
    sequence.sort();
    sequence.forEach((x) => {
      expect(bag.pop()).toBe(x);
    });
    expect(bag.size).toBe(0);
  });

  test('SortedBag descending', () => {
    const bag = new SortedBag(true);
    sequence.forEach((x) => bag.push(x));
    expect(bag.size).toBe(sequence.length);
    sequence.sort().reverse();
    sequence.forEach((x: number) => {
      expect(bag.pop()).toBe(x);
    });
    expect(bag.size).toBe(0);
  });

  test('SlidingMedian', () => {
    const n = 10000;
    const duration = 100;
    const acc = new SlidingMedian(1, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue()).toBeCloseTo(i / 2, 6);
      } else {
        expect(acc.getValue()).toBeCloseTo((2 * i - duration + 1) / 2, 6);
      }
    }
  });

  test('Gaussian math', () => {
    expect(lambertW(1)).toBeCloseTo(0.56714, 4);
    expect(lambertW(1000)).toBeCloseTo(5.2496, 4);
    expect(lambertW(0.5)).toBeCloseTo(0.351734, 4);
    expect(lambertW(1 / 144)).toBeCloseTo(0.006897, 4);
    expect(estimateBandwidth(1 / 12)).toBeCloseTo(0.090058, 4);
  });
});
