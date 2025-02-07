package plugin

import (
	"testing"
	"time"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

/*
func TestQueryData(t *testing.T) {
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	ds := Datasource{
		client: client,
	}

	ariaQuery := models.AriaOpsQuery{
		ResourceId: "4870891d-835e-48c4-b30b-25e7663c8efa",
		Metric:     "cpu|demandmhz",
	}
	jsonMesssage, err := json.Marshal(ariaQuery)
	require.NoError(t, err)
	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON:  jsonMesssage,
				},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}
}
*/

// Test AriaClient.GetMetrics
func TestGetMetricFrames(t *testing.T) {
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	query := models.ResourceStatsRequest{
		ResourceId:         []string{"dd3f76cc-4c44-4e3b-913a-17af826d8d28"},
		StatKey:            []string{"cpu|demandpct"},
		Begin:              (time.Now().Unix() - 86400) * 1000,
		End:                time.Now().Unix() * 1000,
		IntervalType:       "MINUTES",
		IntervalQuantifier: 5,
		RollUpType:         "AVG",
	}
	response := models.ResourceStatsResponse{}
	err = client.GetMetrics(&query, &response)
	require.NoError(t, err)
	ds := Datasource{
		client: client,
	}
	frames := ds.FramesFromResourceMetrics("A", map[string]string{"dd3f76cc-4c44-4e3b-913a-17af826d8d28": "acclvcfopsn09.acc.broadcom.net"}, &response.Values[0])
	require.NotEmpty(t, frames)
}
