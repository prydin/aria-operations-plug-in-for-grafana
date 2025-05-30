package plugin

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSlidingAverage(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingAverage(1, 10, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		if i < int(duration) {
			require.Equal(t, float64(i)/2.0, acc.GetValue().Value, "Error at sample %d", i)
		} else {
			require.Equal(t, (2.0*float64(i)-float64(duration)+1.0)/2.0, acc.GetValue().Value)

		}
	}
}

func seqSum(x float64) float64 {
	return (x * (x + 1)) / 2
}

func TestSlidingSum(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingSum(1, 10, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		if i < int(duration) {
			require.Equal(t, seqSum(float64(i)), acc.GetValue().Value, "Error at sample %d", i)
		} else {
			require.Equal(t, seqSum(float64(i))-seqSum(float64(i)-float64(duration)), acc.GetValue().Value)
		}
	}
}

func TestMaxToggle(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMax(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i*2), float64(i))
		acc.Push(int64(i*2+1), float64(-i))
		require.Equal(t, float64(i), acc.GetValue().Value)
	}
}

func TestMinToggle(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMin(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i*2), float64(i))
		acc.Push(int64(i*2+1), float64(-i))
		require.Equal(t, float64(-i), acc.GetValue().Value)
	}
}

func TestMaxIncreasing(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMax(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		require.Equal(t, float64(i), acc.GetValue().Value)
	}
}

func TestMinIncreasing(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMin(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		if i < int(duration) {
			require.Equal(t, float64(0), acc.GetValue().Value)
		} else {
			require.Equal(t, float64(int64(i)-duration+1), acc.GetValue().Value)
		}
	}
}

func TestMaxDecreasing(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMax(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(-i))
		if i < int(duration) {
			require.Equal(t, float64(0), acc.GetValue().Value)
		} else {
			require.Equal(t, float64(duration-int64(i)-1), acc.GetValue().Value)
		}
	}
}

func TestMinDecreasing(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMin(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(-i))
		require.Equal(t, float64(-i), acc.GetValue().Value)
	}
}

var stddev = []float64{
	0, 0.707106781, 1, 1.290994449, 1.58113883, 1.870828693, 2.160246899,
	2.449489743, 2.738612788, 3.027650354,
}

func TestStdDev(t *testing.T) {
	n := 1000
	duration := int64(10)
	acc := NewSlidingStdDev(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		v := acc.GetValue().Value
		if i < int(duration) {
			require.InDelta(t, stddev[i], v, 0.0001)
		} else {
			require.InDelta(t, stddev[len(stddev)-1], v, 0.0001)
		}
	}
}
