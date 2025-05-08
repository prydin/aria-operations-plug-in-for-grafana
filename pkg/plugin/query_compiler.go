package plugin

import (
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
	cq := models.CompiledQuery{
		ResourceQuery: models.ResourceRequest{
			AdapterKind:    adapterKinds,
			ResourceKind:   resourceKinds,
			Name:           q.Query.Name,
			Regex:          q.Query.Regex,
			ResourceHealth: q.Query.Health,
			ResourceState:  q.Query.State,
			ResourceStatus: q.Query.Status,
		},
	}
	cq.Metrics = q.Query.Metrics
	return &cq, nil
}
