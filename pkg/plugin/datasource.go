package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
)

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	client *AriaClient
}

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	pluginSettings, error := models.LoadPluginSettings(&settings)
	if error != nil {
		return nil, error
	}
	client := NewAriaClient("https://"+pluginSettings.Host, pluginSettings.TlsSkipVerify)
	return &Datasource{client}, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

func (d *Datasource) query(_ context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	var response backend.DataResponse

	// backend.Logger.Debug("*********** Secrets", "secrets", pCtx.DataSourceInstanceSettings.DecryptedSecureJSONData)

	// Unmarshal the JSON into our queryModel.
	var qm models.AriaOpsQuery

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}
	backend.Logger.Debug("Unmarshal", "query", qm)
	backend.Logger.Debug("Unmarshal", "query", qm.AdvancedMode)

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/developers/plugin-tools/introduction/data-frames
	frame := data.NewFrame("response")

	// add fields.
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, []time.Time{query.TimeRange.From, query.TimeRange.To}),
		data.NewField("values", nil, []int64{10, 20}),
	)

	// add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	settings := req.PluginContext.DataSourceInstanceSettings
	pluginSettings, err := models.LoadPluginSettings(req.PluginContext.DataSourceInstanceSettings)

	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Unable to load settings"
		return res, nil
	}

	password := models.LoadSecrets(settings)["password"]
	// backend.Logger.Debug("Secrets", "secrets", models.LoadSecrets(settings))
	err = d.client.RefreshAuthTokenIfNeeded(pluginSettings.Username, password, pluginSettings.AuthSource)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Unable to authenticate: %s", err)
		return res, nil
	}

	// Try a simple API call
	var apiResult AdapterKindResponse
	err = d.client.GetAdapterKinds(&apiResult)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Unable to perform API call: %s", err)
		return res, nil
	}
	if len(apiResult.AdapterKind) == 0 {
		res.Status = backend.HealthStatusError
		res.Message = "API call returned empty list"
		return res, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Success!",
	}, nil
}
