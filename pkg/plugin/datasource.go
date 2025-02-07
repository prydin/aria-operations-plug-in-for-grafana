package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
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

	d.authenticate(pCtx)
	var qm models.AriaOpsQuery

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}
	backend.Logger.Debug("Unmarshal", "query", qm)
	backend.Logger.Debug("Unmarshal", "query", qm.AdvancedMode)

	// Compile the query model
	cq, err := CompileQuery(&qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("query compilation: %v", err.Error()))
	}

	// Get the resources
	var resources models.ResourceResponse
	err = d.client.GetResources(&cq.ResourceQuery, &resources)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("resource fetch: %v", err.Error()))
	}

	// Get the metrics
	resourceMap := make(map[string]string)
	for _, resource := range resources.ResourceList {
		resourceMap[resource.Identifier] = resource.ResourceKey.Name
	}

	frames, err := d.GetMetrics(query.RefID, resourceMap, cq.Metrics, query.TimeRange, query.Interval)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("querying metrics: %v", err.Error()))
	}
	response.Frames = frames

	/*
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
		response.Frames = append(response.Frames, frame) */
	return response
}

func (d *Datasource) authenticate(pCtx backend.PluginContext) error {
	pluginSettings, err := models.LoadPluginSettings(pCtx.DataSourceInstanceSettings)
	if err != nil {
		return err
	}
	password := models.LoadSecrets(pCtx.DataSourceInstanceSettings)["password"]
	// backend.Logger.Debug("Secrets", "secrets", models.LoadSecrets(settings))
	err = d.client.RefreshAuthTokenIfNeeded(pluginSettings.Username, password, pluginSettings.AuthSource)
	if err != nil {
		return err
	}
	return nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	err := d.authenticate(req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("Unable to authenticate: %s", err)
		return res, nil
	}

	// Try a simple API call
	var apiResult models.AdapterKindResponse
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

// Get metrics from the API
func (d *Datasource) GetMetrics(
	refID string,
	resources map[string]string,
	metrics []string,
	timeRange backend.TimeRange,
	interval time.Duration,
	//aggregation models.AggregationSpec,
	//smootherSpec models.SlidingWindowSpec
) (data.Frames, error) {
	resourceIds := make([]string, 0)
	for k := range resources {
		resourceIds = append(resourceIds, k)
	}
	metricQuery := models.ResourceStatsRequest{
		ResourceId:         resourceIds,
		StatKey:            metrics,
		Begin:              timeRange.From.UnixMilli(),
		End:                timeRange.To.UnixMilli(),
		RollUpType:         "AVG",
		IntervalType:       "MINUTES",
		IntervalQuantifier: int64(math.Max(interval.Minutes(), 5)),
	}
	backend.Logger.Debug("get metrics", "query", metricQuery)
	metricResponse := models.ResourceStatsResponse{}
	err := d.client.GetMetrics(&metricQuery, &metricResponse)
	backend.Logger.Debug("get metrics returned", "count", len(metricResponse.Values))
	if err != nil {
		return nil, err
	}
	frames := make(data.Frames, 0)
	for _, resourceMetrics := range metricResponse.Values {
		frames = append(frames, d.FramesFromResourceMetrics(refID, resources, &resourceMetrics)...)
	}
	return frames, nil
}

func (d *Datasource) FramesFromResourceMetrics(refId string, resources map[string]string, resourceMetrics *models.ResourceStats) data.Frames {
	frames := make(data.Frames, 0)
	resId := resourceMetrics.ResourceId
	for _, envelope := range resourceMetrics.StatList.Stat {
		resName := "unknown"
		if r, ok := resources[resId]; ok {
			resName = r
		}
		labels := map[string]string{"resourceName": resName}
		frame := data.NewFrame(envelope.StatKey.Key)
		timestamps := make([]time.Time, len(envelope.Timestamps))
		values := make([]float64, len(envelope.Timestamps))
		for i, ts := range envelope.Timestamps {
			timestamps[i] = time.Unix(ts/1000, 0)
			values[i] = float64(envelope.Data[i])
		}
		frame.Fields = append(frame.Fields,
			data.NewField("Time", nil, timestamps),
			data.NewField("Value", labels, values))
		frames = append(frames, frame)
		backend.Logger.Debug("framesFromResourceMetrics", "field", len(frame.Fields))
	}
	backend.Logger.Debug("framesFromResourceMetrics", "frameCount", len(frames))
	return frames
}

/*

private framesFromResourceMetrics(
    refId: string,
    resources: Map<string, string>,
    resourceMetric: ResourceStats,
    smootherFactory: (() => Smoother) | null
  ): DataFrame[] {
    const frames: MutableDataFrame[] = [];
    const resId = resourceMetric.resourceId;
    for (const envelope of resourceMetric.stat_list.stat) {
      const labels: Labels = {
        resourceName: resources.get(resId) || 'unknown',
      };
      const frame = new MutableDataFrame({
        refId: refId,
        name: envelope.statKey.key,
        fields: [
          { name: 'Time', type: FieldType.time },
          { name: 'Value', type: FieldType.number, labels: labels },
        ],
      });
      frames.push(frame);
      if (smootherFactory) {
        const smoother = smootherFactory();
        // Run samples through the smoother
        envelope.timestamps.forEach((ts, i) => {
          const point = smoother.pushAndGet(ts, envelope.data[i]);
          frame.add({ Time: point.timestamp, Value: point.value });
        });
      } else {
        // No smoother
        envelope.timestamps.forEach((ts, i) => {
          frame.add({ Time: envelope.timestamps[i], Value: envelope.data[i] });
        });
      }
    }
    return frames;
  }

async getMetrics(
    refId: string,
    resources: Map<string, string>,
    metrics: string[],
    begin: number,
    end: number,
    maxPoints: number,
    aggregation: AggregationSpec | undefined,
    smootherSpec: SlidingWindowSpec | undefined
  ): Promise<DataFrame[]> {
    const interval = Math.max((end - begin) / (maxPoints * 60000), 5);

    // TODO: Extend time window if there is a smoother that needs time shifting
    const smootherFactory = smootherSpec
      ? () =>
        smootherFactories[smootherSpec.type](
          interval * 60000,
          end - begin,
          smootherSpec.params
        )
      : null;
    const extenedEnd = smootherSpec?.params?.shift
      ? smootherSpec.params.duration
      : 0;
    const payload = {
      resourceId: [...resources.keys()],
      statKey: metrics,
      begin: begin.toFixed(0),
      end: (end + extenedEnd).toFixed(0),
      rollUpType: 'AVG',
      intervalType: 'MINUTES',
      intervalQuantifier: interval.toFixed(0),
    };
    const resp = await this.post<ResourceStatsRequest, ResourceStatsResponse>(
      'resources/stats/query',
      payload
    );
    if (aggregation) {
      let propertyMap = new Map<string, Map<string, string>>();
      if (aggregation.properties) {
        propertyMap = await this.getPropertiesForResources(
          resp.values.map((r: ResourceStats) => r.resourceId),
          aggregation.properties
        );
      }
      const stats = new Stats(aggregation);
      for (const r of resp.values) {
        for (const envelope of r.stat_list.stat) {
          const pm = propertyMap.get(r.resourceId) || new Map<string, string>();
          pm.set('$statKey', envelope.statKey.key);
          stats.add(envelope.timestamps, envelope.data, pm);
        }
      }
      return stats.toFrames(refId, aggregation, smootherFactory);
    }
    return resp.values
      .map((r: ResourceStats): DataFrame[] => {
        return this.framesFromResourceMetrics(
          refId,
          resources,
          r,
          smootherFactory
        );
      })
      .flat();
  }
*/
