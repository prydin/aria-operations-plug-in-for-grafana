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

import "github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"

const (
	UnaryCondition = iota
	StringCondition
	DoubleCondition
)

type Condition struct {
	Type                int      `json:"type,omitempty"`
	ConjunctiveOperator string   `json:"conjunctiveOperator,omitempty"`
	DoubleValue         *float64 `json:"doubleValue,omitempty"`
	StringValue         *string  `json:"stringValue,omitempty"`
	Key                 string   `json:"key,omitempty"`
	Operator            string   `json:"operator,omitempty"`
}

type RawQuery struct {
	ResourceKinds      []string               `json:"resourceKinds,omitempty"`
	ResourceIds        []string               `json:"resourceIds,omitempty"`
	Name               []string               `json:"name,omitempty"`
	Regex              []string               `json:"regex,omitempty"`
	Metrics            []string               `json:"metrics,omitempty"`
	Health             []string               `json:"health,omitempty"`
	Status             []string               `json:"status,omitempty"`
	State              []string               `json:"state,omitempty"`
	MetricConditions   []Condition            `json:"metricConditions,omitempty"`
	PropertyConditions []Condition            `json:"propertyConditions,omitempty"`
	Aggregation        models.AggregationSpec `json:"aggregation"`
}

func (c *Condition) WithConjunctive(op string) *Condition {
	c.ConjunctiveOperator = op
	return c
}
