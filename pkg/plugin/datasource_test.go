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

func TestGetPropertiesForResources(t *testing.T) {
	client, err := newAuthenticatedClient()
	require.NoError(t, err)

	ds := Datasource{
		client: client,
	}

	resourceIds := []string{"b0544167-6961-40ff-8b91-d85be7c8307a"}
	propertyKeys := []string{"summary|guest|fullName", "summary|guest|guestFamily"}

	properties, err := ds.getPropertiesForResources(resourceIds, propertyKeys)
	require.NoError(t, err)
	require.NotEmpty(t, properties)

	// Validate that the properties map contains the expected resource ID and keys
	r := resourceIds[0]
	require.Contains(t, properties, r)
	require.Contains(t, properties[r], "summary|guest|fullName")
	require.Contains(t, properties[r], "summary|guest|fullName")
}
