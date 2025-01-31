package plugin

import (
	"crypto/tls"
	json "encoding/json"
	"fmt"

	resty "github.com/go-resty/resty/v2"
)

type AriaClient struct {
	rootURL string
	token   string
	rest    *resty.Client
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

func (a *AriaClient) Authenticate(username, password, authSource string) error {
	request := AuthRequest{Username: username, Password: password, AuthSource: authSource}
	var authResponse AuthResponse
	if err := a.post("/auth/token/acquire", &request, &authResponse); err != nil {
		return err
	}
	a.token = authResponse.Token
	a.rest.SetAuthScheme("vRealizeOpsToken")
	a.rest.SetAuthToken(a.token)
	return nil
}

func (a *AriaClient) GetResources(query *ResourceRequest, response *ResourceResponse) error {
	return a.post("/resources/query", query, response)
}

func (a *AriaClient) GetAdapterKinds(response *AdapterKindResponse) error {
	return a.get("/adapterkinds", response)
}
