package plugin

import (
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMedian(t *testing.T) {
	oddSizeData := []float64{0, 1, 2, 3, 4, 5, 6, 7, 8}
	evenSizeData := []float64{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}
	for range 100 {
		mf := NewMedian()
		rand.Shuffle(len(oddSizeData), func(i, j int) {
			oddSizeData[i], oddSizeData[j] = oddSizeData[j], oddSizeData[i]
		})
		for _, n := range oddSizeData {
			mf.Push(n)
		}
		mf.Push(3.333)
		mf.Pop(3.333)
		require.Equal(t, 4.0, mf.Result())

		mf = NewMedian()
		rand.Shuffle(len(evenSizeData), func(i, j int) {
			evenSizeData[i], evenSizeData[j] = evenSizeData[j], evenSizeData[i]
		})
		for _, n := range evenSizeData {
			mf.Push(n)
		}
		mf.Push(3.333)
		mf.Pop(3.333)
		require.Equal(t, 4.5, mf.Result())
	}
}
