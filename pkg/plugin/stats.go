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
	"container/heap"
	"math"
)

type MinHeap []float64

func (h MinHeap) Len() int           { return len(h) }
func (h MinHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h MinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *MinHeap) Push(x any) {
	*h = append(*h, x.(float64))
}

func (h *MinHeap) Pop() any {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

type MaxHeap []float64

func (h MaxHeap) Len() int           { return len(h) }
func (h MaxHeap) Less(i, j int) bool { return h[i] > h[j] } // Note the > for max-heap
func (h MaxHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *MaxHeap) Push(x any) {
	*h = append(*h, x.(float64))
}

func (h *MaxHeap) Pop() any {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

// Median struct with min and max heaps
type Median struct {
	lowHeap  MaxHeap // Max-heap for the lower half
	highHeap MinHeap // Min-heap for the higher half
}

// Constructor initializes the MedianFinder
func NewMedian() *Median {
	lowHeap := MaxHeap{}
	highHeap := MinHeap{}
	heap.Init(&lowHeap)
	heap.Init(&highHeap)
	return &Median{lowHeap: lowHeap, highHeap: highHeap}
}

// AddNum adds a number to the data structure
func (mf *Median) Push(num float64) {
	if mf.lowHeap.Len() == 0 || num <= (mf.lowHeap)[0] {
		heap.Push(&mf.lowHeap, num)
	} else {
		heap.Push(&mf.highHeap, num)
	}

	// Rebalance the heaps
	if mf.lowHeap.Len() > mf.highHeap.Len()+1 {
		heap.Push(&mf.highHeap, heap.Pop(&mf.lowHeap))
	} else if mf.highHeap.Len() > mf.lowHeap.Len() {
		heap.Push(&mf.lowHeap, heap.Pop(&mf.highHeap))
	}
}

// FindMedian returns the median of current data stream
func (mf *Median) Result() float64 {
	if mf.lowHeap.Len() == 0 && mf.highHeap.Len() == 0 {
		return math.NaN()
	}
	if mf.lowHeap.Len() == mf.highHeap.Len() {
		return float64((mf.lowHeap)[0]+(mf.highHeap)[0]) / 2.0
	}
	return float64((mf.lowHeap)[0])
}
