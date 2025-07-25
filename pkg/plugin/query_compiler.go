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

func CompileQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	if query.AdvancedMode {
		return compileAdvancedQuery(query)
	} else {
		return compileSimpleQuery(query)
	}
}

func expandStringArgs(args []string) []string {
	expanded := make([]string, 0)
	for _, arg := range args {
		if strings.HasPrefix(arg, "{") && strings.HasSuffix(arg, "}") {
			inner := arg[1 : len(arg)-1]
			parts := strings.Split(inner, ",")
			for _, s := range parts {
				expanded = append(expanded, strings.TrimSpace(s))
			}
		} else {
			expanded = append(expanded, arg)
		}
	}
	return expanded
}

func compileSimpleQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	resourceQueries := []models.ResourceRequest{
		{ResourceId: []string{query.ResourceId}},
	}
	return &models.CompiledQuery{
		ResourceQueries: resourceQueries,
		Metrics:         []string{query.Metric},
	}, nil
}

func makeResourceQuery(adapterKinds, resourceKinds []string, q grammar.RawQuery, propConditions, statConditions *models.FilterSpec) models.ResourceRequest {
	return models.ResourceRequest{
		AdapterKind:        expandStringArgs(adapterKinds),
		ResourceKind:       expandStringArgs(resourceKinds),
		Name:               expandStringArgs(q.Name),
		Regex:              expandStringArgs(q.Regex),
		ResourceHealth:     expandStringArgs(q.Health),
		ResourceState:      expandStringArgs(q.State),
		ResourceStatus:     expandStringArgs(q.Status),
		PropertyConditions: propConditions,
		StatConditions:     statConditions,
	}
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

	resourceQueries := make([]models.ResourceRequest, 0)
	propConditions, err := makeFilterSpec(q.Query.PropertyConditions, true)
	if err != nil {
		return nil, err
	}
	metricConditions, err := makeFilterSpec(q.Query.MetricConditions, false)
	if err != nil {
		return nil, err
	}
	var metricFilter *models.FilterSpec
	if len(metricConditions) > 0 {
		metricFilter = metricConditions[0]
	}
	if len(propConditions) == 0 {
		resourceQueries = append(resourceQueries, makeResourceQuery(adapterKinds, resourceKinds, q.Query, nil, metricFilter))
	}

	// For now, we only support IN queries on properties, so we only have to iterate over the property conditions
	for _, propCondition := range propConditions {
		resourceQueries = append(resourceQueries,
			makeResourceQuery(adapterKinds, resourceKinds, q.Query, propCondition, metricFilter))
	}

	cq := models.CompiledQuery{
		ResourceQueries: resourceQueries,
		Aggregation:     q.Query.Aggregation,
		Smoother:        q.Query.Smoother,
	}

	cq.Metrics = q.Query.Metrics
	return &cq, nil
}

func makeFilterSpec(conditions []*grammar.Condition, inAllowed bool) ([]*models.FilterSpec, error) {
	if len(conditions) == 0 {
		return nil, nil
	}
	// Determine the conjunction
	conj := "OR"
	for i, condition := range conditions {
		if i > 0 && condition.ConjunctiveOperator != conj {
			return nil, errors.New("combinations of AND and OR is not yet supported") // TODO: Implement this!
		}
		if condition.ConjunctiveOperator != "" {
			conj = condition.ConjunctiveOperator
		}
	}
	nativeConditions := make([]models.Condition, 0)
	deferredInConditions := make([]*grammar.Condition, 0)
	for _, condition := range conditions {
		if condition.Operator == "IN" {
			if !inAllowed {
				return nil, errors.New("IN operator is not allowed in this context")
			}
			if conj == "OR" {
				// The simple case: The overall conjunctive is "OR", so we just expand
				// the IN operator to a bunch of OR
				parts := condition.Value.([]string)
				for _, part := range parts {
					trimmedPart := strings.TrimSpace(part)
					nativeConditions = append(nativeConditions, models.Condition{
						Key:         condition.Key,
						Operator:    "EQ",
						StringValue: &trimmedPart,
					})
				}
			} else {
				deferredInConditions = append(deferredInConditions, condition)
			}
			continue
		}
		c := models.Condition{
			Key:      condition.Key,
			Operator: condition.Operator,
		}
		switch v := condition.Value.(type) {
		case float64:
			val := v
			c.DoubleValue = &val
		case string:
			val := v
			c.StringValue = &val
		default:
			return nil, errors.New("unsupported value type for condition: " + condition.Key)
		}
		nativeConditions = append(nativeConditions, c)
	}
	return []*models.FilterSpec{
		{
			Conditions:          nativeConditions,
			ConjunctionOperator: conj,
		},
	}, nil
}
