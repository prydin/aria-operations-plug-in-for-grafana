package experiments

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParser(t *testing.T) {
	q := Test{}
	q.Buffer = "foo bar"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
}
