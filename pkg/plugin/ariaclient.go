package plugin

import (
	"crypto/tls"
	json "encoding/json"
	"fmt"
	"sync"
	"time"

	resty "github.com/go-resty/resty/v2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
		return fmt.Errorf("%d: %s", status, rawResponse.Status())
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
		return fmt.Errorf("%d: %s", status, rawResponse.Status())
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
	request := AuthRequest{Username: username, Password: password, AuthSource: authSource}
	var authResponse AuthResponse
	if err := a.post("/auth/token/acquire", &request, &authResponse); err != nil {
		return err
	}
	token := authResponse.Token
	a.rest.SetAuthScheme("vRealizeOpsToken")
	a.rest.SetAuthToken(token)
	a.authTimestamp = time.Now()
	return nil
}

func (a *AriaClient) GetResources(query *ResourceRequest, response *ResourceResponse) error {
	return a.post("/resources/query", query, response)
}

func (a *AriaClient) GetAdapterKinds(response *AdapterKindResponse) error {
	return a.get("/adapterkinds", response)
}

func (a *AriaClient) GetResourceKinds(adapterKind string, response *ResourceKindResponse) error {
	return a.get("/adapterkinds/"+adapterKind+"/resourcekinds", response)
}
