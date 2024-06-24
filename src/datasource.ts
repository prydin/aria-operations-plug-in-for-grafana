/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the 
Aria Operations plug-in for Grafana project. You may not use this file except 
in compliance with the License.

BSD-2 License

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

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  Labels,
  DataFrame,
  MetricFindValue,
  FieldType,
} from '@grafana/data';

import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { catchError } from 'rxjs/operators';

import /* eslint-disable-line @typescript-eslint/no-unused-vars */ _, {
  defaults,
} from 'lodash';

import {
  AriaOpsQuery,
  AriaOpsOptions,
  defaultQuery,
  ResourceRequest,
  AggregationSpec,
  SlidingWindowSpec,
  ResourceResponse,
  Resource,
  AdapterKindResponse,
  ResourceKindResponse,
  ResourceKindAttributeResponse,
  ResourceKindAttribute,
  ResourceStatsRequest,
  ResourceStatsResponse,
  ResourcePropertiesRequest,
  ResourcePropertiesResponse,
  AuthSourceResponse,
  ResourceStats,
  KeyNamePair,
  AriaOpsVariableQuery,
} from './types';
import { lastValueFrom } from 'rxjs';
import { buildExpression, compileQuery } from 'queryparser/compiler';
import { Stats } from 'aggregator';
import { Smoother, smootherFactories } from 'smoother';
import { evaulateExpression } from 'expr_eval';

type Resolver = { (token: string): void };
type Rejecter = { (reason: string): void };

type AuthWaiter = {
  resolve: Resolver;
  reject: Rejecter;
};

const SAAS_CSP_AUTH_URL = 'csp/authorize';

interface ErrorResponse {
  message: string;
  validationFailures: Array<{ failureMessage: string }>;
}

class AriaOpsError extends Error {
  static buildMessage(content: ErrorResponse): string {
    let message = content.message;
    if (content.validationFailures) {
      message += ' Details: ';
      for (const v of content.validationFailures) {
        message += v.failureMessage + '. ';
      }
    }

    return message;
  }
  constructor(content: ErrorResponse) {
    super(AriaOpsError.buildMessage(content));
  }
}

export class AriaOpsDataSource extends DataSourceApi<
  AriaOpsQuery,
  AriaOpsOptions
> {
  authWaiters: AuthWaiter[] = [];
  token?: string;
  url?: string;
  static EXPIRATION_TIME = 15 * 60 * 1000; // Expire after 15 minutes. Should be more than enough

  constructor(instanceSettings: DataSourceInstanceSettings<AriaOpsOptions>) {
    super(instanceSettings);
    this.url = (instanceSettings.url || '') + '/aria-operations/suite-api/api/';
    void this.authenticate(instanceSettings.jsonData);
  }

  private async request<REQ, RESP>(
    method: string,
    path: string,
    data: REQ,
    useToken: boolean,
    headerOverride?: Record<string, string>
  ): Promise<RESP> {
    const token = useToken ? await this.getToken() : '';
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: token,
      ...headerOverride,
    };
    // console.log(method, path, data);
    const resp = await lastValueFrom(
      getBackendSrv()
        .fetch<string>({
          method: method,
          url: (this.url || '') + path,
          data: data,
          headers: headers,
          responseType: 'text',
        })
        .pipe(
          catchError((err: FetchResponse<object>) => {
            console.log('err.data', err.data, typeof err.data);
            const content = err.data as ErrorResponse;
            if (content?.message) {
              throw new AriaOpsError(content);
            }
            throw `${err.status} : ${err.statusText}`;
          })
        )
    );
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    /* eslint-disable @typescript-eslint/no-unsafe-return */
    return JSON.parse(resp.data, function (key: string, value: any): any {
      if (key.includes('-')) {
        this[key.replace('-', '_')] = value;
      } else {
        return value;
      }
    }) as RESP;
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    /* eslint-enable @typescript-eslint/no-unsafe-argument */
    /* eslint-enable @typescript-eslint/no-unsafe-call */
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    /* eslint-enable @typescript-eslint/no-unsafe-return */
  }

  private post<REQ, RESP>(path: string, data: REQ): Promise<RESP> {
    return this.request<REQ, RESP>('POST', path, data, true);
  }

  private get<RESP>(path: string): Promise<RESP> {
    return this.request<null, RESP>('GET', path, null, true);
  }

  async getResources(
    adapterKind: string,
    resourceKind: string,
    name?: string
  ): Promise<Map<string, string>> {
    return this.getResourcesWithRq({
      adapterKind: [adapterKind],
      resourceKind: [resourceKind],
      name: name ? [name] : undefined,
    });
  }

  async getResourcesWithRq(
    request: ResourceRequest
  ): Promise<Map<string, string>> {
    const resp = await this.post<ResourceRequest, ResourceResponse>(
      'resources/query?pageSize=1000',
      request
    );
    return new Map(
      resp.resourceList.map((r: Resource) => [r.identifier, r.resourceKey.name])
    );
  }

  async getAdapterKinds(): Promise<Map<string, string>> {
    const resp = await this.get<AdapterKindResponse>('adapterkinds');
    return new Map(resp.adapter_kind.map((a: KeyNamePair) => [a.key, a.name]));
  }

  async getResourceKinds(adapterKind: string): Promise<Map<string, string>> {
    const resp = await this.get<ResourceKindResponse>(
      'adapterkinds/' + adapterKind + '/resourcekinds'
    );
    return new Map(resp.resource_kind.map((a: KeyNamePair) => [a.key, a.name]));
  }

  async getStatKeysForResourceKind(
    adapterKind: string,
    resourceKind: string
  ): Promise<Map<string, string>> {
    const resp = await this.get<ResourceKindAttributeResponse>(
      'adapterkinds/' +
        adapterKind +
        '/resourcekinds/' +
        resourceKind +
        '/statkeys'
    );
    return new Map(
      resp.resourceTypeAttributes.map((a: ResourceKindAttribute) => [
        a.key,
        a.description,
      ])
    );
  }

  async getPropertiesForResourceKind(
    adapterKind: string,
    resourceKind: string
  ): Promise<Map<string, string>> {
    const resp = await this.get<ResourceKindAttributeResponse>(
      'adapterkinds/' +
        adapterKind +
        '/resourcekinds/' +
        resourceKind +
        '/properties'
    );
    return new Map(
      resp.resourceTypeAttributes.map((a: ResourceKindAttribute) => [
        a.key,
        a.description,
      ])
    );
  }

  async getPropertiesForResources(
    resourceIds: string[],
    propertyKeys: string[]
  ): Promise<Map<string, Map<string, string>>> {
    const payload = { resourceIds, propertyKeys, instanced: false };
    const resp = await this.post<
      ResourcePropertiesRequest,
      ResourcePropertiesResponse
    >('resources/properties/latest/query', payload);
    const resourceMap = new Map();
    for (const resource of resp.values) {
      const properties = new Map();
      resourceMap.set(resource.resourceId, properties);
      for (const property of resource.property_contents.property_content) {
        if (property.values) {
          properties.set(property.statKey, property.values[0] || '<undefined>');
        } else if (property.data) {
          properties.set(property.statKey, property.data[0] || '<undefined>');
        } else {
          properties.set(property.statKey, '<undefined>');
        }
      }
    }
    return resourceMap;
  }

  async getAuthSources(): Promise<Map<string, string>> {
    const resp = await this.get<AuthSourceResponse>('auth/sources');
    return new Map(resp.sources.map((a: KeyNamePair) => [a.key, a.name]));
  }

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

  private async authenticateSaaS() {
    const response = await this.request<string, { access_token: string }>(
      'POST',
      SAAS_CSP_AUTH_URL,
      '',
      false,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    );
    return 'CSPToken ' + response.access_token;
  }

  private async authenticateOnPrem(jsonData: AriaOpsOptions) {
    const payload = {
      username: jsonData.username,
    };
    const url =
      jsonData.authSource && jsonData.authSource !== 'Local Users'
        ? 'auth/token/acquire-withsource'
        : 'auth/token/acquire';
    const response = await this.request<typeof payload, { token: string }>(
      'POST',
      url,
      payload,
      false
    );
    return 'vRealizeOpsToken ' + response.token;
  }

  private async authenticate(jsonData: AriaOpsOptions) {
    try {
      this.token = jsonData.isSaaS
        ? await this.authenticateSaaS()
        : await this.authenticateOnPrem(jsonData);
      setTimeout(() => {
        void this.authenticate(jsonData);
      }, AriaOpsDataSource.EXPIRATION_TIME);
      this.authWaiters.forEach((waiter) => waiter.resolve(this.token || ''));
      this.authWaiters = [];
    } catch (e: any) {
      this.authWaiters.forEach((waiter) => waiter.reject(e as string));
    }
  }

  private getToken(): Promise<string> {
    // We may end up here before the first authentication has finished. If that happens, we
    // add ourselves to a list of promises to be resolved once we're authenticated.
    return new Promise<string>((resolve, reject) => {
      if (this.token) {
        resolve(this.token);
      } else {
        this.authWaiters.push({ resolve, reject });
      }
    });
  }

  async metricFindQuery(
    query: AriaOpsVariableQuery,
    options?: any
  ): Promise<MetricFindValue[]> {
    // Avoid error messages by returning an empty array for empty queries
    if (!query?.query || query.query === '') {
      return [];
    }
    const q = { advancedMode: true, queryText: query.query, refId: '' };
    console.log('findMetricQuery', q);
    const compiledQuery = compileQuery(q, options.scopedVars);
    if (!compiledQuery.query) {
      throw "Expressions aren't allowed for metric queries";
    }
    const resp = await this.post<ResourceRequest, ResourceResponse>(
      'resources/query?pageSize=1000',
      compiledQuery.query.resourceQuery
    );
    return resp.resourceList.map((r: Resource): MetricFindValue => {
      return { text: r.resourceKey.name, value: r.resourceKey.name };
    });
  }

  async query(
    options: DataQueryRequest<AriaOpsQuery>
  ): Promise<DataQueryResponse> {
    const { range, maxDataPoints } = options;
    const from = range.from.valueOf();
    const to = range.to.valueOf();

    const data: DataFrame[] = [];
    for (const target of options.targets) {
      console.log('Target', target);
      if (target.hide) {
        continue;
      }
      const query = defaults(target, defaultQuery);

      console.log('Query', query);

      // Skip empty targets (would generate errors otherwise)
      if (
        !query.advancedMode &&
        (!query.adapterKind ||
          !query.resourceId ||
          !query.resourceKind ||
          !query.metric)
      ) {
        continue;
      }

      const compiled = compileQuery(query, options.scopedVars);
      if (compiled.query) {
        const q = compiled.query;
        const resources = await this.getResourcesWithRq(q.resourceQuery);
        const chunk =
          resources && resources.size > 0
            ? await this.getMetrics(
                query.refId,
                resources,
                q.metrics,
                from,
                to,
                maxDataPoints || 10000,
                q.aggregation,
                q.slidingWindow
              )
            : [];
        chunk.forEach((d) => data.push(d));
      } else if (compiled.expression) {
        const fn = buildExpression(compiled.expression);
        const result = evaulateExpression(fn, data, query.refId);
        result.forEach((d) => data.push(d));
      }
    }
    return { data };
  }

  async testDatasource() {
    // Sign in and list adapter kinds. If this works, the plugin can communicate with vR Ops and chances are
    // great the rest of it works too.
    try {
      const adapterKinds = await this.getAdapterKinds();
      if (!adapterKinds || adapterKinds.size === 0) {
        return {
          status: 'failure',
          message:
            'Was able to connect, but getAdapterKinds returned nothing. Check that backend Aria Operations is healthy',
        };
      }
    } catch (e: any) {
      return {
        status: 'error',
        message:
          typeof e === 'string'
            ? e
            : e instanceof Error
            ? e.message
            : 'Unspecified error',
      };
    }
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
