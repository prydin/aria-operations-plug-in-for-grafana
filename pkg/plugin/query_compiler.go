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
	"errors"
	"strings"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/grammar"
	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
)

var operatorMap = map[string]string{
	"and":             "AND",
	"or":              "OR",
	"in":              "IN",
	"not in":          "NOT_IN",
	"contains":        "CONTAINS",
	"starts_with":     "STARTS_WITH",
	"ends_with":       "ENDS_WITH",
	"not starts_with": "NOT_STARTS_WITH",
	"not ends_with":   "NOT_ENDS_WITH",
	"not contains":    "NOT_CONTAINS",
	"not regex":       "NOT_REGEX",
	"exists":          "EXISTS",
	"not exists":      "NOT_EXISTS",
	">":               "GT",
	"<":               "LT",
	">=":              "GTE",
	"<=":              "LTE",
	"=":               "EQ",
	"!=":              "NE",
}

func CompileQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	if query.AdvancedMode {
		return compileAdvancedQuery(query)
	} else {
		return compileSimpleQuery(query)
	}
}

func compileSimpleQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	return &models.CompiledQuery{
		ResourceQuery: models.ResourceRequest{
			ResourceId: []string{query.ResourceId},
		},
		Metrics: []string{query.Metric},
	}, nil
}

func compileAdvancedQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	q := grammar.QueryParser{}
	q.Buffer = query.QueryText
	err := q.Init()
	if err != nil {
		return nil, err
	}
	err = q.Parse()
	if err != nil {
		return nil, err
	}
	q.Execute()

	resourceKinds := make([]string, len(q.Query.ResourceKinds))
	adapterKinds := make([]string, len(q.Query.ResourceKinds))
	for i, kind := range q.Query.ResourceKinds {
		parts := strings.Split(kind, ":")
		adapterKinds[i] = parts[0]
		resourceKinds[i] = parts[1]
	}

	pc, err := makeFilterSpec(q.Query.PropertyConditions)
	if err != nil {
		return nil, err
	}
	mc, err := makeFilterSpec(q.Query.MetricConditions)
	if err != nil {
		return nil, err
	}

	cq := models.CompiledQuery{
		ResourceQuery: models.ResourceRequest{
			AdapterKind:        adapterKinds,
			ResourceKind:       resourceKinds,
			Name:               q.Query.Name,
			Regex:              q.Query.Regex,
			ResourceHealth:     q.Query.Health,
			ResourceState:      q.Query.State,
			ResourceStatus:     q.Query.Status,
			PropertyConditions: pc,
			StatConditions:     mc,
		},
		Aggregation: q.Query.Aggregation,
	}

	cq.Metrics = q.Query.Metrics
	return &cq, nil
}

func makeFilterSpec(conditions []grammar.Condition) (*models.FilterSpec, error) {
	if len(conditions) == 0 {
		return nil, nil
	}
	conj := "AND"
	if len(conditions) > 1 {
		conj = conditions[0].ConjunctiveOperator
	}
	nativeConditions := make([]models.Condition, 0)
	for _, condition := range conditions {
		if len(conditions) > 1 && condition.ConjunctiveOperator != conj {
			return nil, errors.New("combinations of AND and OR is not yet supported") // TODO: Implement this!
		}
		operator, ok := operatorMap[condition.Operator]
		if !ok {
			return nil, errors.New("unsupported operator: " + condition.Operator)
		}
		if condition.Type == grammar.UnaryCondition {
			c := models.Condition{
				Key:         condition.Key,
				Operator:    operator,
				StringValue: condition.StringValue,
				DoubleValue: condition.DoubleValue,
			}
			nativeConditions = append(nativeConditions, c)
		}
	}
	return &models.FilterSpec{
		Conditions:          nativeConditions,
		ConjunctionOperator: conj,
	}, nil
}
