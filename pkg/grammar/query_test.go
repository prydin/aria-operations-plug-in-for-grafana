package grammar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSimpleName(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).name(\"foo\").metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Name[0])
}

func TestMultipleName(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).name(\"foo\", \"bar\", \"baz\").metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Name[0])
	require.Equal(t, "bar", q.Query.Name[1])
	require.Equal(t, "baz", q.Query.Name[2])
}

func TestSimpleRegex(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).regex(\"foo\").metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Regex[0])
}

func TestMultipleRegex(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).regex(\"foo\", \"bar\", \"baz\").metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Regex[0])
	require.Equal(t, "bar", q.Query.Regex[1])
	require.Equal(t, "baz", q.Query.Regex[2])
}

func TestSimpleHealth(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereHealth(RED).metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "RED", q.Query.Health[0])
}

func TestMultipleHealth(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereHealth(RED,YELLOW).metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "RED", q.Query.Health[0])
	require.Equal(t, "YELLOW", q.Query.Health[1])
}
