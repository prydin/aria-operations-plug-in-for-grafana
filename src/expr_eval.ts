import { DataFrame, Field, Vector } from "@grafana/data";
import { time } from "console";
import { DataFrameBundle, ExpressionEvaluator, ValueBundle } from "types";


interface ValueStore {
    [key: string]: {
        [key: string]: {
            timestamps: Vector<number>
            values: Vector<number>
        }
    }
}

export const evaulateExpression = (expr: ExpressionEvaluator, data: DataFrame[]): DataFrame[] => {
    // Collect list of timestamps. We can pick a metric at random, since a specific 
    // timestamp needs to be present in all series in order to produce a valid result.
    let timestamps: Vector<number> | undefined;
    const frame = data[0];
    const tsField = frame.fields.find((f) => f.name === "Time");
    timestamps = tsField?.values;
    if(!timestamps) {
        // No timestamps => empty result. Not much to do.
        console.log("Warning: Timestamps missing for series. Skipping expression")
        return [];
    }

    // Stuff the frame data into a friendlier (and faster) structure
    const metricInstances: { [key: string]: boolean} = {}
    const valueStore: ValueStore = {};
    for(const frame of data) {
        if(!frame.refId) {
            continue;
        }
        if(!valueStore[frame.refId]) {
            valueStore[frame.refId] = {};
        }
        for(const field of frame.fields) {
            let values = null;
            let timestamps = null;
            if(field.name === "Time") {
                timestamps = field.values;
            }
            if(field.name === "Value") {
                values = field.values;
            }
            let labelKey = ""
            for(const key in field.labels) {
                labelKey += key + ":" + field.labels[key] + ","
            }
            if(!(timestamps && values)) {
                break;
            }
            const frameKey = frame.name + labelKey;
            valueStore[frame.refId][frameKey] = { timestamps, values};
            metricInstances[frameKey] = true;
        }
    }

    // Evaluate expression for each timestamp
    for(var i = 0; i < timestamps.length; ++i) {
        for(const frameKey in metricInstances) {                                                                          
            const getter = (key: string): number => {
                const entry = valueStore[key][frameKey];
                if(!(entry.timestamps && entry.values)) {
                    return NaN;
                }
                const idx = findTSIndex(entry.timestamps, timestamps!.get(i));
                return entry.values.get(idx);
            }
        } 
    }


    // For each variable...
    for(const refId in data) {
        // Get the list of frames for this variable. There will be one frame per metric,
        // but each metric can be subdivided by tags.
        const frameList = data[refId]
        for(const frame of frameList) {


            let key = frame.name + "("
            for(const field of frame.fields) {
                key += field.name + "(";
                for()
                key += ","
                
            }
        }
    }
}

const findTSIndex = (timestamps: Vector<number>, ts: number): number => {
    let step = timestamps.length / 2;
    let pos = step;
    while(step > 0) {
        if(timestamps.get(pos) === ts) {
            return pos;
        }
        if(timestamps.get(pos) > ts) {
            pos -= step;
        } else {
            pos += step;
        }
    }
    // Couldn't find it.
    return NaN
}