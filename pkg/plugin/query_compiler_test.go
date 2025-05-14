/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the
Aria Operations plug-in for Grafana project. You may not use this file except
in compliance with the License.

# BSD-2 License

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

func TestSingleConditionQuery(t *testing.T) {
	q := models.AriaOpsQuery{
		QueryText:    "resource(VMWARE:VirtualMachine).whereMetrics(cpu|demandmhz > 0).metrics(cpu|demandmhz)",
		AdvancedMode: true,
	}
	cq, err := CompileQuery(&q)
	require.NoError(t, err)
	require.Equal(t, "VMWARE", cq.ResourceQuery.AdapterKind[0])
	require.Equal(t, "VirtualMachine", cq.ResourceQuery.ResourceKind[0])
	require.Equal(t, "AND", cq.ResourceQuery.StatConditions.ConjunctionOperator)
	require.Equal(t, "cpu|demandmhz", cq.ResourceQuery.StatConditions.Conditions[0].Key)
	require.Equal(t, 0.0, *cq.ResourceQuery.StatConditions.Conditions[0].DoubleValue)
	require.Equal(t, "cpu|demandmhz", cq.Metrics[0])
}

func TestAggregationQuery(t *testing.T) {
	for _, agg := range aggregations {
		q := models.AriaOpsQuery{
			QueryText:    "resource(VMWARE:VirtualMachine).name(\"hello\").metrics(cpu|demandmhz)." + agg + "()",
			AdvancedMode: true,
		}
		cq, err := CompileQuery(&q)
		require.NoError(t, err, "Offending statement: %s", q.QueryText)
		require.Equal(t, "VMWARE", cq.ResourceQuery.AdapterKind[0])
		require.Equal(t, "VirtualMachine", cq.ResourceQuery.ResourceKind[0])
		require.Equal(t, "cpu|demandmhz", cq.Metrics[0])
		require.Equal(t, agg, cq.Aggregation.Type)
	}
}

func TestSlicedAggregationQuery(t *testing.T) {
	for _, agg := range aggregations {
		q := models.AriaOpsQuery{
			QueryText:    "resource(VMWARE:VirtualMachine).name(\"hello\").metrics(cpu|demandmhz)." + agg + "(summary|guest|fullName)",
			AdvancedMode: true,
		}
		cq, err := CompileQuery(&q)
		require.NoError(t, err, "Offending statement: %s", q.QueryText)
		require.Equal(t, "VMWARE", cq.ResourceQuery.AdapterKind[0])
		require.Equal(t, "VirtualMachine", cq.ResourceQuery.ResourceKind[0])
		require.Equal(t, "cpu|demandmhz", cq.Metrics[0])
		require.Equal(t, agg, cq.Aggregation.Type)
		require.ElementsMatch(t, []string{"summary|guest|fullName"}, cq.Aggregation.Properties)
	}
}
