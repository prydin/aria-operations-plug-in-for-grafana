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
			require.Equal(t, 2.0*(float64(i)-float64(duration)+1.0)/2.0, acc.GetValue().Value)
		}
	}
}
