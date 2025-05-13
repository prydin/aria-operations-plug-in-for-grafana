// Aria Operations plug-in for Grafana
// Copyright 2023 VMware, Inc.
//
// The BSD-2 license (the "License") set forth below applies to all parts of the
// Aria Operations plug-in for Grafana project. You may not use this file except
// in compliance with the License.
//
// BSD-2 License
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// Redistributions of source code must retain the above copyright notice,
// this list of conditions and the following disclaimer.
//
// Redistributions in binary form must reproduce the above copyright notice, this
// list of conditions and the following disclaimer in the documentation and/or
// other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

package plugin

import (
	"encoding/json"
	"errors"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/influxdata/tdigest"
	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
)

type StatProducer func(acc *Accumulator) float64

var statProducers = map[string]StatProducer{
	"avg":        (*Accumulator).GetAverage,
	"stddev":     (*Accumulator).GetStandardDeviation,
	"min":        (*Accumulator).GetMin,
	"max":        (*Accumulator).GetMax,
	"sum":        (*Accumulator).GetSum,
	"count":      (*Accumulator).GetCount,
	"variance":   (*Accumulator).GetVariance,
	"percentile": (*Accumulator).GetPercentile,
}

type Accumulator struct {
	sum        float64
	count      int
	max        float64
	min        float64
	vAcc       float64
	avg        float64
	wantDigest bool
	digest     *tdigest.TDigest
	percentile float64
	mu         sync.Mutex
}

func NewAccumulator(wantPercentile bool, percentile float64) *Accumulator {
	acc := &Accumulator{
		max:        math.Inf(-1),
		min:        math.Inf(1),
		wantDigest: wantPercentile,
		percentile: percentile,
	}
	if wantPercentile {
		acc.digest = tdigest.New() // TODO: Do we need to specify compression
	}
	return acc
}

func (a *Accumulator) AddDataPoint(value float64) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.sum += value
	a.count++
	a.max = math.Max(a.max, value)
	a.min = math.Min(a.min, value)
	avg := a.sum / float64(a.count)
	a.vAcc += (value - a.avg) * (value - avg)
	a.avg = avg
	if a.digest != nil {
		a.digest.Add(value, 1.0)
	}
}

func (a *Accumulator) GetAverage() float64 {
	return a.avg
}

func (a *Accumulator) GetCount() float64 {
	return float64(a.count)
}

func (a *Accumulator) GetSum() float64 {
	return a.sum
}

func (a *Accumulator) GetMin() float64 {
	return a.min
}

func (a *Accumulator) GetMax() float64 {
	return a.max
}

func (a *Accumulator) GetVariance() float64 {
	if a.count > 1 {
		return a.vAcc / float64(a.count-1)
	}
	return 0
}

func (a *Accumulator) GetStandardDeviation() float64 {
	return math.Sqrt(a.GetVariance())
}

func (a *Accumulator) GetPercentile() float64 {
	if a.digest == nil {
		return math.NaN()
	}
	return a.digest.Quantile(a.percentile / 100)
}

type Bucket struct {
	accumulators   map[int64]*Accumulator
	wantPercentile bool
	percentile     float64
	mu             sync.Mutex
}

func NewBucket(wantPercentile bool, percentile float64) *Bucket {
	return &Bucket{
		accumulators:   make(map[int64]*Accumulator),
		wantPercentile: wantPercentile,
		percentile:     percentile,
	}
}

func (b *Bucket) AddDataPoint(timestamp int64, value float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	acc, exists := b.accumulators[timestamp]
	if !exists {
		acc = NewAccumulator(b.wantPercentile, b.percentile)
		b.accumulators[timestamp] = acc
	}
	acc.AddDataPoint(value)
}

func (b *Bucket) GetResults() map[int64]*Accumulator {
	b.mu.Lock()
	defer b.mu.Unlock()

	keys := make([]int64, 0, len(b.accumulators))
	for k := range b.accumulators {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	sorted := make(map[int64]*Accumulator)
	for _, k := range keys {
		sorted[k] = b.accumulators[k]
	}
	return sorted
}

type Stats struct {
	wantPercentile bool
	percentile     float64
	buckets        map[string]*Bucket
	mu             sync.Mutex
}

func NewStats(aggregation models.AggregationSpec) *Stats {
	wantPercentile := aggregation.Type == "percentile"
	percentile := 0.0
	if wantPercentile {
		percentile = aggregation.Parameter
	}
	return &Stats{
		wantPercentile: wantPercentile,
		percentile:     percentile,
		buckets:        make(map[string]*Bucket),
	}
}

func (s *Stats) Add(metricKey string, timestamps []int64, values []float64, properties map[string]string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	properties["$statKey"] = metricKey
	keyBytes, _ := json.Marshal(properties)
	key := string(keyBytes)

	bucket, exists := s.buckets[key]
	if !exists {
		bucket = NewBucket(s.wantPercentile, s.percentile)
		s.buckets[key] = bucket
	}

	for i, ts := range timestamps {
		bucket.AddDataPoint(ts, values[i])
	}
}

func (s *Stats) ToFrames(refId string, aggregation models.AggregationSpec, smootherFactory func() Smoother) (data.Frames, error) {
	produce, exists := statProducers[aggregation.Type]
	if !exists {
		return nil, errors.New("internal error: producer " + aggregation.Type + " not found")
	}

	var frames data.Frames
	for key, bucket := range s.buckets {
		var labels map[string]string
		if err := json.Unmarshal([]byte(key), &labels); err != nil {
			return nil, err
		}
		statKey := labels["$statKey"]
		delete(labels, "$statKey")

		results := bucket.GetResults()
		timestamps := make([]time.Time, 0, len(results))
		values := make([]float64, 0, len(results))
		for ts, acc := range results {
			value := produce(acc)
			timestamps = append(timestamps, time.Unix(ts/1000, 0))
			values = append(values, value)
		}
		frame := data.NewFrame(statKey,
			data.NewField("Time", nil, timestamps),
			data.NewField("Value", labels, values))
		frame.RefID = refId
		frames = append(frames, frame)
	}
	return frames, nil
}
