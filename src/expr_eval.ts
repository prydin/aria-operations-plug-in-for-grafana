import {
  DataFrame,
  FieldType,
  Labels,
  MutableDataFrame,
  Vector,
} from '@grafana/data';
import { ExpressionEvaluator } from 'types';

interface ValueStore {
  [key: string]: {
    [key: string]: {
      timestamps: Vector<number>;
      values: Vector<number>;
      labels?: Labels;
    };
  };
}

export const evaulateExpression = (
  expr: ExpressionEvaluator,
  data: DataFrame[],
  resultRefId: string
): DataFrame[] => {
  if (!data || data.length == 0) {
    return [];
  }

  // Collect list of timestamps. We can pick a metric at random, since a specific
  // timestamp needs to be present in all series in order to produce a valid result.
  const frame = data[0];
  const tsField = frame.fields.find((f) => f.name === 'Time');
  if (!tsField) {
    console.log('Series without timestamps');
    return [];
  }
  const masterTimestamps: Vector<number> = tsField?.values;
  console.log('ts', masterTimestamps?.toArray());
  if (!masterTimestamps) {
    // No timestamps => empty result. Not much to do.
    console.log('Warning: Timestamps missing for series. Skipping expression');
    return [];
  }

  // Stuff the frame data into a friendlier (and faster) structure
  const metricNames: { [key: string]: string } = {};
  const metricInstances: { [key: string]: Labels | undefined } = {};
  const valueStore: ValueStore = {};
  for (const frame of data) {
    if (!(frame.refId && frame.name)) {
      // Not sure when this would happen, but can't handle it either way...
      continue;
    }
    if (!metricNames[frame.refId]) {
      metricNames[frame.refId] = frame.name;
    }
    if (frame.name !== metricNames[frame.refId]) {
      throw 'Only one metric per frame is allowed with expressions';
    }
    if (!frame.refId) {
      continue;
    }
    if (!valueStore[frame.refId]) {
      valueStore[frame.refId] = {};
    }
    // Find timestamp and value fields.
    let frameKey = '';
    let values = null;
    let timestamps = null;
    let labels: Labels | undefined = undefined;
    for (const field of frame.fields) {
      if (field.name === 'Time') {
        timestamps = field.values;
      }
      if (field.name === 'Value') {
        values = field.values;
        labels = field.labels;
        for (const key in field.labels) {
          frameKey += key + ':' + field.labels[key] + ',';
        }
      }
    }
    if (!(timestamps && values)) {
      break;
    }
    valueStore[frame.refId][frameKey] = { timestamps, values, labels };
    metricInstances[frameKey] = labels;
  }

  const result: DataFrame[] = [];
  for (const frameKey in metricInstances) {
    const labels = metricInstances[frameKey];
    const frame = new MutableDataFrame({
      refId: resultRefId,
      name: 'calculated',
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'Value', type: FieldType.number, labels },
      ],
    });

    for (const timestamp of masterTimestamps.toArray()) {
      // Define the getter function
      const getter = (key: string): number => {
        const entry = valueStore[key][frameKey];
        if (!(entry.timestamps && entry.values)) {
          return NaN;
        }
        const idx = findTSIndex(entry.timestamps, timestamp);
        return entry.values.get(idx);
      };
      const value = expr(getter);
      if (isNaN(value)) {
        continue;
      }
      frame.add({ Time: timestamp, Value: value });
    }
    result.push(frame);
  }
  return result;
};

export const findTSIndex = (timestamps: Vector<number>, ts: number): number => {
  // Exported for testability

  let high = timestamps.length - 1;
  let low = 0;
  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2);
    const pivot = timestamps.get(mid);
    if (pivot == ts) {
      return mid;
    }
    if (pivot < ts) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Couldn't find it.
  return NaN;
};
