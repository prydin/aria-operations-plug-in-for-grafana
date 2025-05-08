package plugin

import (
	"testing"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestCompileSimpleQuery(t *testing.T) {
	q := models.AriaOpsQuery{
		ResourceId:   "12345",
		Metric:       "cpu|demandmhz",
		AdvancedMode: false,
	}
	cq, err := CompileQuery(&q)
	require.NoError(t, err)
	require.Equal(t, "12345", cq.ResourceQuery.ResourceId[0])
	require.Equal(t, "cpu|demandmhz", cq.Metrics[0])
}

func TestCompileNameQuery(t *testing.T) {
	q := models.AriaOpsQuery{
		QueryText:    "resource(VMWARE:VirtualMachine).name(\"foo\").metrics(cpu|demandmhz)",
		AdvancedMode: true,
	}
	cq, err := CompileQuery(&q)
	require.NoError(t, err)
	require.Equal(t, "VMWARE", cq.ResourceQuery.AdapterKind[0])
	require.Equal(t, "VirtualMachine", cq.ResourceQuery.ResourceKind[0])
	require.Equal(t, "foo", cq.ResourceQuery.Name[0])
	require.Equal(t, "cpu|demandmhz", cq.Metrics[0])
}
