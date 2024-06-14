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
import { buildExpression, compileQuery } from 'queryparser/compiler';
import {
  GaussianEstimator,
  SlidingAverage,
  SlidingMax,
  SlidingMedian,
  SlidingMin,
  SlidingStdDev,
  SlidingSum,
  SortedBag,
} from 'smoother';
import {
  AggregationSpec,
  ExpressionData,
  ExpressionNode,
  Query,
  SlidingWindowSpec,
} from 'types';

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

const simpleAllQueryResult: Query = {
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

const simpleNameQueryResult: Query = {
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

const simpleRegexQueryResult: Query = {
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

const simpleWherePropertiesQueryResult: Query = {
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

const negatedWherePropertiesQueryResult: Query = {
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

const simpleWhereMetricsQueryResult: Query = {
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

const simpleWhereHealthQueryResult: Query = {
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

const simpleWhereStateQueryResult: Query = {
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

const simpleWhereStatusQueryResult: Query = {
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

const simpleWhereTagsQueryResult: Query = {
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

const aggregationResultTemplate: Query = {
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
  params: { duration: 0 },
};

const slidingWindowResultTemplate: Query = {
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

const testCompile = (queryText: string): Query => {
  return compileQuery({ queryText, advancedMode: true, refId: 'dummy' }, {})
    .query!;
};

const testCompileExpr = (queryText: string): ExpressionNode => {
  return compileQuery({ queryText, advancedMode: true, refId: 'dummy' }, {})
    .expression!;
};

const testExpression = (
  expression: string,
  data: ExpressionData,
  expected: number
) => {
  var expr = testCompileExpr(expression);
  var f = buildExpression(expr);
  expect(f(data, '')).toBe(expected);
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
    let shift = false;
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
          `resource(VMWARE:VirtualMachine).all().metrics(cpu|demandmhz).${sw}(7${timeunit[0]}, ${shift})`
        );
        slidingWindowResultTemplate.slidingWindow = {
          type: sw,
          params: { duration: 1000 * 7 * (timeunit[1] as number), shift },
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
  test('Smoke test', () => {
    const acc = new SlidingSum(1000, 10000, { duration: 2000 });
    expect(acc.pushAndGet(1, 42).value).toBe(42);
    expect(acc.pushAndGet(2, 42).value).toBe(84);
    expect(acc.pushAndGet(3, 42).value).toBe(84);
  });
  test('Average', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingAverage(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue().value).toBe(i / 2);
      } else {
        expect(acc.getValue().value).toBe((2 * i - duration + 1) / 2);
      }
    }
  });
  test('Sum', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingSum(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue().value).toBe(seqSum(i));
      } else {
        expect(acc.getValue().value).toBe(seqSum(i) - seqSum(i - duration));
      }
    }
  });
  test('Max toggle', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMax(1, 10000, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i * 2, i);
      acc.push(i * 2 + 1, -i);
      expect(acc.getValue().value).toBe(i);
    }
  });

  test('Max backwards', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMax(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, -i);
      if (i < duration) {
        expect(acc.getValue().value).toBe(-0);
      } else {
        expect(acc.getValue().value).toBe(duration - i - 1);
      }
    }
  });

  test('Min toggle', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMin(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i * 2, i);
      acc.push(i * 2 + 1, -i);
      expect(acc.getValue().value).toBe(-i);
    }
  });

  test('Min backwards', () => {
    const n = 1000;
    const duration = 100;
    const acc = new SlidingMin(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue().value).toBe(0);
      } else {
        expect(acc.getValue().value).toBe(i - duration + 1);
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
    const acc = new SlidingStdDev(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue().value).toBeCloseTo(stddev[i], 6);
      } else {
        expect(acc.getValue().value).toBeCloseTo(stddev[stddev.length - 1], 6);
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
    const acc = new SlidingMedian(1, 10, { duration });
    for (let i = 0; i < n; ++i) {
      acc.push(i, i);
      if (i < duration) {
        expect(acc.getValue().value).toBeCloseTo(i / 2, 6);
      } else {
        expect(acc.getValue().value).toBeCloseTo((2 * i - duration + 1) / 2, 6);
      }
    }
  });

  test('Gaussian math', () => {});

  test('Gaussian', () => {
    const g = new GaussianEstimator(300000, 8640000, { duration: 60000 });
    console.log(g.h);
  });
});

describe('Expression', () => {
  test('Constant expression', () => {
    testExpression('expr(1)', {}, 1);
  });
  test('Negated constant expression', () => {
    testExpression('expr(-1)', {}, -1);
  });
  test('Constant addition', () => {
    testExpression('expr(1 +1)', {}, 2);
  });
  test('Constant subtractionition', () => {
    testExpression('expr(43 - 1)', {}, 42);
  });

  test('Constant double addition', () => {
    testExpression('expr(1 + 2 + 3)', {}, 6);
  });

  test('Constant multiplication', () => {
    testExpression('expr(2*4)', {}, 8);
  });
  test('Constant dvision', () => {
    testExpression('expr(16 / 2)', {}, 8);
  });

  test('Constant double multiplication', () => {
    testExpression('expr(2 * 3 * 4)', {}, 24);
  });

  test('Constant mixed arithmetic 1', () => {
    testExpression('expr(1 + 2 * 3)', {}, 7);
  });

  test('Constant mixed arithmetic 2', () => {
    testExpression('expr(2 * 2 + 2 * 3)', {}, 10);
  });

  test('Constant parenteses 1', () => {
    testExpression('expr(3 * (2 + 1))', {}, 9);
  });

  test('Constant parenteses 2', () => {
    testExpression('expr((1+ 2) * (2 + 1))', {}, 9);
  });

  test('Constant kitchen sink', () => {
    testExpression(
      'expr((45 - 12) * (2 + 1 * (10/5)))',
      {},
      (45 - 12) * (2 + 1 * (10 / 5))
    );
  });

  const vars = {
    'v1/': 1,
    'v2/': 2,
    'v3/': 3,
    'v4/': 4,
    'v5/': 5,
  };

  test('Variable', () => {
    testExpression('expr(v1)', vars, 1);
  });

  test('Variable negation', () => {
    testExpression('expr(-v1)', vars, -1);
  });

  test('Variable complex negation', () => {
    testExpression('expr(v2 - -v1)', vars, 3);
  });

  test('Variable addition', () => {
    testExpression('expr(v1 + v2)', vars, 3);
  });

  test('Variable subtraction', () => {
    testExpression('expr(v2 - v1)', vars, 1);
  });

  test('Variable kitchen sink', () => {
    testExpression(
      'expr((v4 - v2) * (v2 + v3 * (v4 / v2)))',
      vars,
      (4 - 2) * (2 + 3 * (4 / 2))
    );
  });
});
