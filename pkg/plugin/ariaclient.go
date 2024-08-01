package plugin

import (
	resty "github.com/go-resty/resty/v2"
)

type AriaClient struct {
	rootURL string
	token   string
	rest    *resty.Client
}

func NewAriaClient(rootURL string) *AriaClient {
	client := &AriaClient{rootURL: rootURL, rest: resty.New()}
	client.rest.BaseURL = rootURL
	return client
}

func (a *AriaClient) newRequest() *resty.Request {
	return a.rest.R().SetHeader("Accept", "appliction/json").SetHeader("Content-Type", "application/json")
}

func (a *AriaClient) authenticate(username, password, authSource string) error {
	payload := AuthRequest{Username: username, Password: password, AuthSource: authSource}
	response, err := a.newRequest().
		SetBody(payload).
		Post("/auth/token/acquire")
	if err != nil {
		return err
	}
	response.
}

/*
 "url": "https://{{.JsonData.host}}/suite-api/api/auth/token/acquire",
      "method": "POST",
      "body": {
        "username": "{{.JsonData.username}}",
        "password": "{{.SecureJsonData.password}}"
      }
*/
