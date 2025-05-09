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
