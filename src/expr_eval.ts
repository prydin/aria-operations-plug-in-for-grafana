import {
  DataFrame,
  Field,
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
  resultRefId: string,
  resultName: string
): DataFrame[] => {
  // Collect list of timestamps. We can pick a metric at random, since a specific
  // timestamp needs to be present in all series in order to produce a valid result.
  const frame = data[0];
  const tsField = frame.fields.find((f) => f.name === 'Time');
  const timestamps = tsField?.values;
  if (!timestamps) {
    // No timestamps => empty result. Not much to do.
    console.log('Warning: Timestamps missing for series. Skipping expression');
    return [];
  }

  // Stuff the frame data into a friendlier (and faster) structure
  const metricInstances: { [key: string]: Labels | undefined } = {};
  const valueStore: ValueStore = {};
  for (const frame of data) {
    if (!frame.refId) {
      continue;
    }
    if (!valueStore[frame.refId]) {
      valueStore[frame.refId] = {};
    }
    for (const field of frame.fields) {
      let values = null;
      let timestamps = null;
      if (field.name === 'Time') {
        timestamps = field.values;
      }
      if (field.name === 'Value') {
        values = field.values;
      }
      let labelKey = '';
      for (const key in field.labels) {
        labelKey += key + ':' + field.labels[key] + ',';
      }
      if (!(timestamps && values)) {
        break;
      }
      const frameKey = frame.name + labelKey;
      const labels = field.labels;
      valueStore[frame.refId][frameKey] = { timestamps, values, labels };
      metricInstances[frameKey] = labels;
    }
  }

  const result: DataFrame[] = [];
  for (const frameKey in metricInstances) {
    const labels = metricInstances[frameKey];
    const frame = new MutableDataFrame({
      refId: resultRefId,
      name: resultName,
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'Value', type: FieldType.number, labels },
      ],
    });

    for (var i = 0; i < timestamps.length; ++i) {
      const timestamp = timestamps.get(i);

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

const findTSIndex = (timestamps: Vector<number>, ts: number): number => {
  let step = timestamps.length / 2;
  let pos = step;
  while (step > 0) {
    if (timestamps.get(pos) === ts) {
      return pos;
    }
    if (timestamps.get(pos) > ts) {
      pos -= step;
    } else {
      pos += step;
    }
  }
  // Couldn't find it.
  return NaN;
};
