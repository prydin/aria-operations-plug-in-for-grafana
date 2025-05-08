package grammar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSimpleName(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).name(\"foo\").metrics(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Name[0])
}

func TestMultipleName(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).name(\"foo\", \"bar\", \"baz\").metrics(cpu|demandmhz)"
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
	q.Buffer = "resource(VMWARE:VirtualMachine).regex(\"foo\").metrics(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "foo", q.Query.Regex[0])
}

func TestMultipleRegex(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).regex(\"foo\", \"bar\", \"baz\").metrics(cpu|demandmhz)"
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
	q.Buffer = "resource(VMWARE:VirtualMachine).whereHealth(RED).metrics(cpu|demandmhz)"
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

func TestSimpleState(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereState(RED).metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "RED", q.Query.State[0])
}

func TestMultipleState(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereState(RED,YELLOW).metrics(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "RED", q.Query.State[0])
	require.Equal(t, "YELLOW", q.Query.State[1])
}

func TestSimpleWhereMetrics(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereMetrics(cpu > 42).metric(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "cpu", q.Query.MetricConditions[0].Key)
	require.Equal(t, 42.0, q.Query.MetricConditions[0].DoubleValue)
	require.Equal(t, "", q.Query.MetricConditions[0].ConjunctiveOperator)
}

func TestComplexWhereMetrics(t *testing.T) {
	q := QueryParser{}
	q.Buffer = "resource(VMWARE:VirtualMachine).whereMetrics(cpu > 42 and mem > 1e7 and disk > 1e-2).metrics(cpu|demandmhz)"
	require.NoError(t, q.Init())
	require.NoError(t, q.Parse())
	q.Execute()
	require.Equal(t, "VMWARE:VirtualMachine", q.Query.ResourceKinds[0])
	require.Equal(t, "cpu", q.Query.MetricConditions[0].Key)
	require.Equal(t, 42.0, q.Query.MetricConditions[0].DoubleValue)
	require.Equal(t, "", q.Query.MetricConditions[0].ConjunctiveOperator)
	require.Equal(t, "mem", q.Query.MetricConditions[1].Key)
	require.Equal(t, 1e7, q.Query.MetricConditions[1].DoubleValue)
	require.Equal(t, "AND", q.Query.MetricConditions[1].ConjunctiveOperator)
	require.Equal(t, "disk", q.Query.MetricConditions[2].Key)
	require.Equal(t, 1e-2, q.Query.MetricConditions[2].DoubleValue)
	require.Equal(t, "AND", q.Query.MetricConditions[2].ConjunctiveOperator)

}
