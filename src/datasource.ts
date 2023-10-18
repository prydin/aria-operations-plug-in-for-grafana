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
  FieldType,
  Labels,
  DataFrame,
} from '@grafana/data';

import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { catchError } from 'rxjs/operators';

import _, { defaults } from 'lodash';

import {
  AriaOpsQuery,
  AriaOpsOptions,
  defaultQuery,
  ResourceRequest,
  AggregationSpec,
  SlidingWindowSpec,
} from './types';
import { lastValueFrom } from 'rxjs';
import { compileQuery } from 'queryparser/compiler';
import { Stats } from 'aggregator';
import { Smoother, smootherFactories } from 'smoother';

type Resolver = { (token: string): void };
type Rejecter = { (reason: any): void };

type AuthWaiter = {
  resolve: Resolver;
  reject: Rejecter;
};

class AriaOpsError extends Error {
  static buildMessage(apiResponse: FetchResponse<any>): string {
    const content = apiResponse.data;
    let message = content.message;
    if (content.validationFailures) {
      message += ' Details: ';
      for (const v of content.validationFailures) {
        message += v.failureMessage + '. ';
      }
    }

    return message;
  }
  constructor(apiResponse: FetchResponse<any>) {
    super(AriaOpsError.buildMessage(apiResponse));
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
    this.url = instanceSettings.url + '/aria-operations/suite-api/api/';
    this.authenticate(instanceSettings.jsonData);
  }

  private async request(
    method: string,
    path: string,
    data: any,
    useToken: boolean
  ): Promise<FetchResponse<any>> {
    let token = useToken ? await this.getToken() : '';
    // console.log(method, path, data);
    return lastValueFrom(
      getBackendSrv()
        .fetch<any>({
          method: method,
          url: this.url + path,
          data: data,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'vRealizeOpsToken ' + token,
          },
        })
        .pipe(
          catchError((err) => {
            if (err.data?.message) {
              throw new AriaOpsError(err);
            }
            throw err.status + ': ' + err.statusText;
          })
        )
    );
  }

  private post(path: string, data: any): Promise<FetchResponse<any>> {
    return this.request('POST', path, data, true);
  }

  private get(path: string): Promise<FetchResponse<any>> {
    return this.request('GET', path, null, true);
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
    const resp = await this.post('resources/query?pageSize=1000', request);
    return new Map(
      resp.data.resourceList.map((r: any) => [r.identifier, r.resourceKey.name])
    );
  }

  async getAdapterKinds(): Promise<Map<string, string>> {
    const resp = await this.get('adapterkinds');
    return new Map(resp.data['adapter-kind'].map((a: any) => [a.key, a.name]));
  }

  async getResourceKinds(adapterKind: string): Promise<Map<string, string>> {
    const resp = await this.get(
      'adapterkinds/' + adapterKind + '/resourcekinds'
    );
    return new Map(resp.data['resource-kind'].map((a: any) => [a.key, a.name]));
  }

  async getStatKeysForResourceKind(
    adapterKind: string,
    resourceKind: string
  ): Promise<Map<string, string>> {
    let resp = await this.get(
      'adapterkinds/' +
        adapterKind +
        '/resourcekinds/' +
        resourceKind +
        '/statkeys'
    );
    return new Map(
      resp.data.resourceTypeAttributes.map((a: any) => [a.key, a.name])
    );
  }

  async getPropertiesForResourceKind(
    adapterKind: string,
    resourceKind: string
  ): Promise<Map<string, string>> {
    const resp = await this.get(
      'adapterkinds/' +
        adapterKind +
        '/resourcekinds/' +
        resourceKind +
        '/properties'
    );
    return new Map(
      resp.data.resourceTypeAttributes.map((a: any) => [a.key, a.description])
    );
  }

  async getPropertiesForResources(
    resourceIds: string[],
    propertyKeys: string[]
  ): Promise<Map<string, Map<string, string>>> {
    const payload = { resourceIds, propertyKeys, instanced: false };
    const resp = await this.post('resources/properties/latest/query', payload);
    const resourceMap = new Map();
    for (const resource of resp.data.values) {
      const properties = new Map();
      resourceMap.set(resource.resourceId, properties);
      for (const property of resource['property-contents'][
        'property-content'
      ]) {
        if (property.values) {
          properties.set(property.statKey, property.values[0] || '<undefined>');
        } else if ([property.data]) {
          properties.set(property.statKey, property.data[0] || '<undefined>');
        } else {
          properties.set(property.statKey, '<undefined>');
        }
      }
    }
    return resourceMap;
  }

  async getAuthSources(
    adapterKind: string,
    resourceKind: string
  ): Promise<Map<string, string>> {
    let resp = await this.get('auth/sources');
    return new Map(resp.data.sources.map((a: any) => [a.key, a.description]));
  }

  private framesFromResourceMetrics(
    refId: string,
    resources: Map<string, string>,
    resourceMetric: any,
    smootherFactory: (() => Smoother) | null
  ): DataFrame[] {
    const frames: MutableDataFrame[] = [];
    const smoother = smootherFactory ? smootherFactory() : null;
    let resId = resourceMetric.resourceId;
    for (let envelope of resourceMetric['stat-list'].stat) {
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
      console.log(smoother);
      if (smoother) {
        // Run samples through the smoother
        for (let i in envelope.timestamps) {
          const point = smoother.pushAndGet(
            envelope.timestamps[i],
            envelope.data[i]
          );
          frame.add({ Time: point.timestamp, Value: point.value });
        }
      } else {
        // No smoother
        for (let i in envelope.timestamps) {
          frame.add({ Time: envelope.timestamps[i], Value: envelope.data[i] });
        }
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
    let interval = Math.max((end - begin) / (maxPoints * 60000), 5);

    // TODO: Extend time window if there is a smoother that needs time shifting
    console.log('smoother', smootherSpec?.params);
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
    const resp = await this.post('resources/stats/query', payload);
    if (aggregation) {
      let propertyMap = new Map();
      if (aggregation.properties) {
        propertyMap = await this.getPropertiesForResources(
          resp.data.values.map((r: any) => r.resourceId),
          aggregation.properties
        );
      }
      const stats = new Stats(aggregation);
      for (let r of resp.data.values) {
        for (let envelope of r['stat-list'].stat) {
          const pm = propertyMap.get(r.resourceId) || new Map();
          pm.set('$statKey', envelope.statKey.key);
          stats.add(envelope.timestamps, envelope.data, pm);
        }
      }
      return stats.toFrames(refId, aggregation, smootherFactory);
    }
    return resp.data.values
      .map((r: any): DataFrame[] => {
        return this.framesFromResourceMetrics(
          refId,
          resources,
          r,
          smootherFactory
        );
      })
      .flat();
  }

  private async authenticate(jsonData: AriaOpsOptions) {
    let payload: Object = {
      username: jsonData.username,
    };
    let url =
      jsonData.authSource && jsonData.authSource !== 'Local Users'
        ? 'auth/token/acquire-withsource'
        : 'auth/token/acquire';
    try {
      let response = await this.request('POST', url, payload, false);
      this.token = response.data.token;
      setTimeout(() => {
        this.authenticate(jsonData);
      }, AriaOpsDataSource.EXPIRATION_TIME);
      this.authWaiters.forEach((waiter) => waiter.resolve(this.token!));
      this.authWaiters = [];
    } catch (e: any) {
      this.authWaiters.forEach((waiter) => waiter.reject(e));
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

  async query(
    options: DataQueryRequest<AriaOpsQuery>
  ): Promise<DataQueryResponse> {
    const { range, maxDataPoints } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();
    console.log('Query', options);

    const data: DataFrame[] = [];
    for (let target of options.targets) {
      if (target.hide) {
        continue;
      }
      const query = defaults(target, defaultQuery);

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

      const compiled = compileQuery(query);
      const resources = await this.getResourcesWithRq(compiled.resourceQuery);
      let chunk = await this.getMetrics(
        query.refId,
        resources,
        compiled.metrics,
        from,
        to,
        maxDataPoints || 10000,
        compiled.aggregation,
        compiled.slidingWindow
      );
      chunk.forEach((d) => data.push(d));
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
      console.log(JSON.stringify(e));
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
