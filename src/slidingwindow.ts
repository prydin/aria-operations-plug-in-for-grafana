import { DataFrame } from '@grafana/data';
import { makeDataFrame } from 'utils';

const extractValue = (sample: DataFrame): number[] => {
  let ts = 0;
  let value = 0;
  for (const field of sample.fields) {
    if (field.name == 'Time') {
      ts = field.values.get(0);
    }
    if (field.name == 'Value') {
      value = field.values.get(0);
    }
  }
  return [ts, value];
};

export const slidingMax = (
  samples: DataFrame[],
  windowSize: number
): DataFrame[] => {
  const window = new Array(windowSize);
  const stack = [Number.MIN_VALUE];
  const result: DataFrame[] = [];
  let pos = 0;
  for (const sample of samples) {
    const [ts, value] = extractValue(sample);
    const current = stack[stack.length - 1];
    if (window[pos] == current && stack.length > 0) {
      stack.pop();
    }
    pos = pos == windowSize - 1 ? 0 : pos + 1;
    result.push(
      makeDataFrame(sample.refId, sample.key, sample.labels, ts, current)
    );
    if (value > current) {
      stack.push(value);
    }
  }
};
