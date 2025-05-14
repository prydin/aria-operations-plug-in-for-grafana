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
	"math"
	"strconv"
	"testing"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

var aggregations = []string{
	"avg",
	"sum",
	"count",
	"max",
	"min",
	"variance",
	"stddev",
	"count",
	"median"}

var aggTestData = []float64{1, 2, 3, 4, 5, 6, 7, 8, 9}
var aggResults = []float64{5, 45, 9, 9, 1, 7.5, math.Sqrt(7.5), 9, 5}

var simpleAggregationSpec = models.AggregationSpec{
	Type:       "avg",
	Parameter:  50.0,
	Properties: []string{},
}

func TestSimpleAggregations(t *testing.T) {
	timestamps := make([]int64, len(aggTestData))
	for i := range aggTestData {
		timestamps[i] = 1
	}
	for aggIdx, agg := range aggregations {
		simpleAggregationSpec.Type = agg
		s := NewStats(simpleAggregationSpec)
		for i := range 10 {
			for ts := range aggTestData {
				timestamps[ts] = int64(i)
			}
			s.Add("someMetric", timestamps, aggTestData, make(map[string]string))
		}
		frames, err := s.ToFrames("dummy", simpleAggregationSpec, nil)
		if err != nil {
			t.Fatalf("Error converting to frames: %v", err)
		}
		for _, frame := range frames {
			f := frame.Fields[1]
			for i := range f.Len() {
				require.Equal(t, aggResults[aggIdx], f.At(i))
			}

		}
	}
}

func TestSlicedAggregations(t *testing.T) {
	timestamps := make([]int64, len(aggTestData))
	for i := range aggTestData {
		timestamps[i] = 1
	}
	for aggIdx, agg := range aggregations {

		simpleAggregationSpec.Type = agg
		s := NewStats(simpleAggregationSpec)
		for i := range 10 {
			for ts := range aggTestData {
				timestamps[ts] = int64(i)
			}
			for keyNumber := range 10 {
				keyString := strconv.FormatInt(int64(keyNumber), 10)
				key := map[string]string{
					"foo": keyString,
					"bar": keyString,
				}
				s.Add("someMetric", timestamps, aggTestData, key)
			}
		}
		frames, err := s.ToFrames("dummy", simpleAggregationSpec, nil)
		if err != nil {
			t.Fatalf("Error converting to frames: %v", err)
		}
		require.Equal(t, 10, len(frames))
		for _, frame := range frames {
			f := frame.Fields[1]
			require.Equal(t, f.Labels["foo"], f.Labels["bar"])
			for i := range f.Len() {
				require.Equal(t, aggResults[aggIdx], f.At(i))
			}
		}
	}
}
