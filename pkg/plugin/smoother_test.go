package plugin

import (
	"math"
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

func TestSlidingMedian(t *testing.T) {
	n := 1000
	duration := int64(100)
	acc := NewSlidingMedian(1, 10000, duration, false)
	for i := range n {
		acc.Push(int64(i), float64(i))
		v := acc.GetValue().Value
		if i < int(duration) {
			require.InDelta(t, float64(i)/2, v, 0.0001)
		} else {
			require.InDelta(t, float64(2*int64(i)-duration+1)/2, v, 0.0001)
		}
	}
}

func TestSlidingExponentialAverage(t *testing.T) {
	// String of ones
	g := NewSlidingExponentialAverage(300000, 3600000, 600000, false).(*SlidingExponentialAverage)
	n := 1000

	require.InDelta(t, 0.3934693402873666, g.GetAlpha(), 0.0001)
	g.Push(int64(0), 0.0)
	for i := 0; i < n; i++ {
		g.Push(int64(i), 1.0)
	}
	require.InDelta(t, 1.0, g.GetValue().Value, 0.0001)

	// String of zeroes
	g = NewSlidingExponentialAverage(300000, 3600000, 600000, false).(*SlidingExponentialAverage)
	require.InDelta(t, 0.3934693402873666, g.GetAlpha(), 0.0001)
	g.Push(int64(0), 1.0)
	for i := 0; i < n; i++ {
		g.Push(int64(i), 0.0)
	}
	require.InDelta(t, 0.0, g.GetValue().Value, 0.0001)

	// Alternating one and zero with alhpa = 0.01
	l := -math.Log(0.99)
	r := int64(l * 100000.0)
	d := int64(100000.0)
	g = NewSlidingExponentialAverage(r, 3600000, d, false).(*SlidingExponentialAverage)
	require.InDelta(t, 0.01, g.GetAlpha(), 0.0001)
	n = 10000
	for i := 0; i < n; i++ {
		g.Push(int64(i), float64(i%2))
	}
	require.InDelta(t, 0.5, g.GetValue().Value, 0.01)

}
