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
	"crypto/tls"
	json "encoding/json"
	"fmt"
	"sync"
	"time"

	resty "github.com/go-resty/resty/v2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
)

type AriaClient struct {
	mutex         sync.Mutex
	rootURL       string
	authTimestamp time.Time
	rest          *resty.Client
}

func NewAriaClient(rootURL string, noVerify bool) *AriaClient {
	client := &AriaClient{rootURL: rootURL, rest: resty.New()}
	client.rest.BaseURL = rootURL
	client.rest.SetTLSClientConfig(&tls.Config{InsecureSkipVerify: noVerify})
	client.rest.SetHeader("Accept", "application/json")
	client.rest.SetHeader("Content-Type", "application/json")
	client.rest.SetDebug(true)
	return client
}

func (a *AriaClient) newRequest() *resty.Request {
	return a.rest.R().
		SetHeader("Accept", "application/json").
		SetHeader("Content-Type", "application/json")
}

func (a *AriaClient) post(url string, request any, response any) error {
	rawResponse, err := a.newRequest().
		SetBody(request).
		Post("/suite-api/api" + url)
	if err != nil {
		return err
	}
	status := rawResponse.StatusCode()
	if status >= 300 || status <= 100 {
		return fmt.Errorf("%d: %s - %s", status, rawResponse.Status(), rawResponse.Body())
	}
	if err := json.Unmarshal(rawResponse.Body(), response); err != nil {
		return err
	}
	return nil
}

func (a *AriaClient) get(url string, response any) error {
	rawResponse, err := a.newRequest().
		Get("/suite-api/api" + url)
	if err != nil {
		return err
	}
	status := rawResponse.StatusCode()
	if status >= 300 || status <= 100 {
		return fmt.Errorf("%d: %s - %s", status, rawResponse.Status(), rawResponse.Body())
	}
	if err := json.Unmarshal(rawResponse.Body(), response); err != nil {
		return err
	}
	return nil
}

func (a *AriaClient) RefreshAuthTokenIfNeeded(username, password, authSource string) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	// Reauthenticate one every 10 minutes
	backend.Logger.Debug("Revalidating auth token")
	if time.Since(a.authTimestamp) > 10*time.Minute {
		backend.Logger.Debug("Auth token expired. Reauthenticating")
		if err := a.Authenticate(username, password, authSource); err != nil {
			return err
		}
		backend.Logger.Debug("Reauhtentication was successful")
	}
	return nil
}

func (a *AriaClient) Authenticate(username, password, authSource string) error {
	request := models.AuthRequest{Username: username, Password: password, AuthSource: authSource}
	var authResponse models.AuthResponse
	if err := a.post("/auth/token/acquire", &request, &authResponse); err != nil {
		return err
	}
	token := authResponse.Token
	a.rest.SetAuthScheme("vRealizeOpsToken")
	a.rest.SetAuthToken(token)
	a.authTimestamp = time.Now()
	return nil
}

func (a *AriaClient) GetResources(query *models.ResourceRequest, response *models.ResourceResponse) error {
	return a.post("/resources/query", query, response)
}

func (a *AriaClient) GetAdapterKinds(response *models.AdapterKindResponse) error {
	return a.get("/adapterkinds", response)
}

func (a *AriaClient) GetResourceKinds(adapterKind string, response *models.ResourceKindResponse) error {
	return a.get("/adapterkinds/"+adapterKind+"/resourcekinds", response)
}

func (a *AriaClient) GetMetrics(query *models.ResourceStatsRequest, response *models.ResourceStatsResponse) error {
	raw, err := json.Marshal(query)
	if err != nil {
		return err
	}
	backend.Logger.Debug("GetMetrics", "query", string(raw))
	return a.post("/resources/stats/query", query, response)
}
