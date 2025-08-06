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

package plugin

import (
	"container/heap"
	"math"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Sample struct {
	Timestamp int64
	Value     float64
}

type callbackTarget interface {
	onPush(sample *Sample)
	onEvict(sample *Sample)
	getValue() *Sample
}

type smootherBase struct {
	callbackTarget callbackTarget
	buffer         []*Sample
	head           int
	resolution     int64
	lag            int64
	adjustLag      bool
	totalTime      int64
}

type Smoother interface {
	Push(timestamp int64, value float64)
	PushAndGet(timestamp int64, value float64) *Sample
	GetValue() *Sample
}

type SlidingAverage struct {
	smootherBase
	sum   float64
	count int
}

type SlidingSum struct {
	smootherBase
	sum float64
}

type SlidingMax struct {
	smootherBase
	heap MaxHeap
}

type SlidingMin struct {
	smootherBase
	heap MinHeap
}

type SlidingVariance struct {
	smootherBase
	avg      float64
	vAcc     float64
	sum      float64
	count    int
	full     bool
	isStdDev bool
}

type SlidingMedian struct {
	smootherBase
	median Median
}

type SlidingExponentialAverage struct {
	smootherBase
	alpha           float64
	current         float64
	latestTimestamp int64
}

type GaussianEstimator struct {
	smootherBase
	h          float64
	windowSize int64
}

type SmootherFactory func(resolution int64, totalTime int64, duration int64, shift bool) Smoother

var SmootherFactories = map[string]SmootherFactory{
	"mavg":      NewSlidingAverage,
	"msum":      NewSlidingSum,
	"mmin":      NewSlidingMin,
	"mmax":      NewSlidingMax,
	"mvariance": NewSlidingVariance,
	"mstddev":   NewSlidingStdDev,
	"mmedian":   NewSlidingMedian,
	"mexpavg":   NewSlidingExponentialAverage,
	"mgaussian": NewGaussianEstimator,
}

func newSmootherBase(resolution int64, totalTime int64, duration int64, shift bool) *smootherBase {
	backend.Logger.Info("Creating smoother", "resolution", resolution, "totalTime", totalTime, "duration", duration)
	bufSize := int(totalTime / resolution)
	if bufSize <= 0 {
		bufSize = 1
	}
	return &smootherBase{
		resolution: resolution,
		totalTime:  totalTime,
		buffer:     make([]*Sample, bufSize),
		lag:        duration,
		adjustLag:  shift,
	}
}

func NewSlidingAverage(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingAverage{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		sum:          0,
		count:        0,
	}
	s.callbackTarget = &s
	return &s
}

func (s *SlidingAverage) onPush(sample *Sample) {
	s.sum += sample.Value
	s.count++
}

func (s *SlidingAverage) onEvict(sample *Sample) {
	s.sum -= sample.Value
	s.count--
}

func (s *SlidingAverage) getValue() *Sample {
	backend.Logger.Info("getValue", "sum", s.sum, "count", s.count)
	return s.makeSample(s.sum / float64(s.count))
}

func NewSlidingSum(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingSum{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		sum:          0,
	}
	s.callbackTarget = &s
	return &s
}

func (s *SlidingSum) onPush(sample *Sample) {
	s.sum += sample.Value
}

func (s *SlidingSum) onEvict(sample *Sample) {
	s.sum -= sample.Value
}

func (s *SlidingSum) getValue() *Sample {
	return s.makeSample(s.sum)
}

func NewSlidingMax(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingMax{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		heap:         make(MaxHeap, 0, int(duration/resolution)),
	}
	s.callbackTarget = &s
	heap.Init(&s.heap)
	return &s
}

func (s *SlidingMax) onPush(sample *Sample) {
	heap.Push(&s.heap, sample.Value)
}

func (s *SlidingMax) onEvict(sample *Sample) {
	// If the heap is full and smallest value is about to get dropped, then pop it from the heap
	if s.heap[0] == sample.Value {
		heap.Pop(&s.heap)
	}
}

func (s *SlidingMax) getValue() *Sample {
	v := math.NaN()
	if s.heap.Len() > 0 {
		v = s.heap[0]
	}
	return s.makeSample(v)
}

func NewSlidingMin(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingMin{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		heap:         make(MinHeap, 0, int(duration/resolution)),
	}
	s.callbackTarget = &s
	heap.Init(&s.heap)
	return &s
}

func (s *SlidingMin) onPush(sample *Sample) {
	heap.Push(&s.heap, sample.Value)
}

func (s *SlidingMin) onEvict(sample *Sample) {
	// If the heap is full and smallest value is about to get dropped, then pop it from the heap
	if s.heap[0] == sample.Value {
		heap.Pop(&s.heap)
	}
}

func (s *SlidingMin) getValue() *Sample {
	v := math.NaN()
	if s.heap.Len() > 0 {
		v = s.heap[0]
	}
	return s.makeSample(v)
}

func NewSlidingVariance(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingVariance{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		isStdDev:     false,
	}
	s.callbackTarget = &s
	return &s
}

func NewSlidingStdDev(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingVariance{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
		isStdDev:     true,
	}
	s.callbackTarget = &s
	return &s
}

func (s *SlidingVariance) onPush(sample *Sample) {
	if s.full {
		return
	}
	s.count++
	if s.count >= len(s.buffer) {
		s.full = true
	}

	// Welford's method. The stock version of this is used when the windows isn't full. Once
	// the window fills up, the calculation takes place in onEvict.
	// https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
	v := sample.Value
	s.sum += v
	avg := s.sum / float64(s.count)
	s.vAcc += (v - s.avg) * (v - avg)
	s.avg = avg
}

func (s *SlidingVariance) onEvict(sample *Sample) {
	// Slightly modified version of Welford's method that allows us to remove
	// values that are out of scope.
	current := s.buffer[s.head].Value
	evicted := sample.Value
	oldAvg := s.avg
	s.avg = oldAvg + (current-evicted)/float64(s.count)
	s.vAcc += (current - evicted) * (current - s.avg + evicted - oldAvg)
}

func (s *SlidingVariance) getValue() *Sample {
	if s.count > 1 {
		variance := s.vAcc / float64(s.count-1)
		if s.isStdDev {
			return s.makeSample(math.Sqrt(variance))
		} else {
			return s.makeSample(variance)
		}
	} else {
		return s.makeSample(0)
	}
}

func NewSlidingMedian(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingMedian{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
	}
	s.median = *NewMedian()
	s.callbackTarget = &s
	return &s
}

func (s *SlidingMedian) onPush(sample *Sample) {
	s.median.Push(sample.Value)
}

func (s *SlidingMedian) onEvict(sample *Sample) {
	s.median.Pop(sample.Value)
}

func (s *SlidingMedian) getValue() *Sample {
	return s.makeSample(s.median.Result())
}

func (s *smootherBase) Push(timestamp int64, value float64) {
	s.head = (s.head + 1) % len(s.buffer)
	sample := &Sample{Timestamp: timestamp, Value: value}
	old := s.buffer[s.head]
	s.buffer[s.head] = sample
	s.callbackTarget.onPush(sample)
	if old != nil {
		s.callbackTarget.onEvict(old)
	}
}

func (s *smootherBase) GetValue() *Sample {
	// Clean out stale entries
	latest := s.buffer[s.head].Timestamp
	for i := range s.buffer {
		p := (i + 1) % len(s.buffer)
		sample := s.buffer[p]
		if sample == nil {
			continue
		}
		if sample.Timestamp >= latest-s.lag {
			break
		}
		s.callbackTarget.onEvict(sample)
		s.buffer[p] = nil
	}
	return s.callbackTarget.getValue()
}

func (s *smootherBase) PushAndGet(timestamp int64, value float64) *Sample {
	s.Push(timestamp, value)
	return s.GetValue()
}

func (s *smootherBase) makeSample(value float64) *Sample {
	shift := int64(0)
	if s.adjustLag {
		shift = s.lag / 2
	}
	return &Sample{Timestamp: s.buffer[s.head].Timestamp - shift, Value: value}
}

func NewSlidingExponentialAverage(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	s := SlidingExponentialAverage{
		smootherBase: *newSmootherBase(resolution, totalTime, duration, shift),
	}
	s.alpha = 1.0 - math.Exp(-float64(resolution)/float64(duration))
	backend.Logger.Info("NewSlidingExponentialAverage", "alpha", s.alpha)
	s.current = math.NaN()
	s.callbackTarget = &s
	return &s
}

func (s *SlidingExponentialAverage) GetAlpha() float64 {
	return s.alpha
}

func (s *SlidingExponentialAverage) onPush(sample *Sample) {
	if math.IsNaN(s.current) {
		s.current = sample.Value
	} else {
		s.current = (1.0-s.alpha)*s.current + s.alpha*sample.Value
	}
	s.latestTimestamp = sample.Timestamp
	// backend.Logger.Info("ExpAvg new sample", "sample", sample.Value, "avg", s.current, "alpha", s.alpha)
}

func (s *SlidingExponentialAverage) onEvict(sample *Sample) {
	// DO nothing
}

func (s *SlidingExponentialAverage) getValue() *Sample {
	return &Sample{
		Value:     s.current,
		Timestamp: s.latestTimestamp - s.lag/2,
	}
}

func NewGaussianEstimator(resolution int64, totalTime int64, duration int64, shift bool) Smoother {
	// Since the gaussian decays asymptotically, we expand the
	// window to catch more of the tails. The factor 2 is rather arbitrarily chosen
	// but seems to work.
	s := GaussianEstimator{
		smootherBase: *newSmootherBase(resolution, totalTime, duration*2, shift),
	}
	s.windowSize = duration

	// Calculate the smoothing factor, which is really the standard deviation.
	// We use the fact that the interval -2 * sigma to 2 * sigma from the mean
	// covers about 95% of samples following normal distribution. For the purpose
	// of our kernel, it means that the sliding window covers about 95% of the
	// area under the kernel function graph.
	s.h = float64(duration) / 2
	s.callbackTarget = &s
	return &s
}

func (s *GaussianEstimator) onPush(sample *Sample) {
	// Update the internal state with the new sample
}

func (s *GaussianEstimator) onEvict(sample *Sample) {
	// Update the internal state when a sample is evicted
}

func (s *GaussianEstimator) getValue() *Sample {
	// Implementation note: It migth be more efficient to calculate this in the frequency
	// domain instead, as what we're doing is basically a convolution. However, the point
	// count is probably too low for that to make any meaningful difference.
	sum := float64(0.0)
	wSum := float64(0.0)
	nPoints := len(s.buffer)
	x := float64(s.buffer[s.head].Timestamp)
	for i := 0; i < nPoints; i++ {
		sample := s.buffer[(s.head+i+1)%nPoints]
		if sample == nil {
			continue
		}
		//const g = this.gaussianCoeff[i];
		g := s.gaussian(float64(float64(sample.Timestamp) - x + float64(s.lag/2)))
		sum += g
		wSum += g * sample.Value
	}
	return s.makeSample(wSum / sum)
}

const sqrt2pi = 2.5066282746310002

func (s *GaussianEstimator) gaussian(x float64) float64 {
	return (1 / (sqrt2pi * s.h)) * math.Exp(-(x*x)/(2*s.h*s.h))
}
