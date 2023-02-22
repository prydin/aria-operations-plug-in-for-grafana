import { SelectableValue } from '@grafana/data';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { catchError, lastValueFrom } from 'rxjs';

export const mapToSelectable = (
  map: Map<string, string>
): Array<SelectableValue<string>> => {
  let s: Array<SelectableValue<string>> = [];
  for (let [key, value] of map) {
    s.push({ value: key, label: value });
  }
  return s;
};

export const httpRequest = async (
  method: string,
  url: string,
  data: any,
  useToken: boolean
): Promise<FetchResponse<any>> => {
  return lastValueFrom(
    getBackendSrv()
      .fetch<any>({
        method: method,
        url: url,
        data: data,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .pipe(
        catchError((err) => {
          throw err;
        })
      )
  );
};
