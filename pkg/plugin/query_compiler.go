package plugin

import (
	"errors"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
)

func CompileQuery(query *models.AriaOpsQuery) (*models.CompiledQuery, error) {
	if query.AdvancedMode {
		return nil, errors.New("Not implemented")
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
