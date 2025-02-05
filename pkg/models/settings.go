package models

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type PluginSettings struct {
	IsIaaS        bool   `json:"isSaas"` // TODO: Remove
	Host          string `json:"host"`
	Username      string `json:"username"`
	AuthSource    string `json:"authSource"`
	TlsSkipVerify bool   `json:"tlsSkipVerify"`
	SaasRegion    string `json:"saasRegion"` // TODO: Remove
}

type SecretPluginSettings struct {
	Password string `json:"password"`
}

func LoadPluginSettings(source *backend.DataSourceInstanceSettings) (*PluginSettings, error) {
	settings := PluginSettings{}
	err := json.Unmarshal(source.JSONData, &settings)
	if err != nil {
		return nil, fmt.Errorf("could not unmarshal PluginSettings json: %w", err)
	}

	return &settings, nil
}

func LoadSecrets(source *backend.DataSourceInstanceSettings) map[string]string {
	return source.DecryptedSecureJSONData
}
