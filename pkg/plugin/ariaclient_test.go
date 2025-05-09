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
	"os"
	"testing"
	"time"

	"github.com/prydin/aria-operations-plug-in-for-grafana/pkg/models"
	"github.com/stretchr/testify/require"
	yaml "gopkg.in/yaml.v2"
)

type config struct {
	Url      string `yaml:"url"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

func loadConfig(filename string) (*config, error) {
	// Load config from yaml file
	yamlFile, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var c config
	err = yaml.Unmarshal(yamlFile, &c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func newAuthenticatedClient() (*AriaClient, error) {
	config, err := loadConfig(os.Getenv("ARIA_TEST_CONFIG"))
	if err != nil {
		return nil, err
	}

	client := NewAriaClient(config.Url, true)
	if err = client.RefreshAuthTokenIfNeeded(config.Username, config.Password, "LOCAL"); err != nil {
		return nil, err
	}
	return client, nil
}

// Test AriaClient.authenticate
func TestAuthenticate(t *testing.T) {
	config, err := loadConfig(os.Getenv("ARIA_TEST_CONFIG"))
	require.NoError(t, err)
	client := NewAriaClient(config.Url, true)
	err = client.Authenticate(config.Username, config.Password, "LOCAL")
	require.NoError(t, err)
}

// Test AriaClient.GetResources
func TestGetResources(t *testing.T) {
	var response models.ResourceResponse
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	request := models.ResourceRequest{
		ResourceKind: []string{"VirtualMachine"},
		Name:         []string{"VM_Workload_02"},
	}
	err = client.GetResources(&request, &response)
	require.NoError(t, err)
	require.Equal(t, 1, len(response.ResourceList))
	require.Equal(t, "VM_Workload_02", response.ResourceList[0].ResourceKey.Name)
}

// Test AriaClient.GetAdapterKinds
func TestGetAdapterKinds(t *testing.T) {
	var response models.AdapterKindResponse
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	err = client.GetAdapterKinds(&response)
	require.NoError(t, err)
	require.NotEmpty(t, response.AdapterKind)
	for _, kind := range response.AdapterKind {
		if kind.Key == "VMWARE" {
			return
		}
	}
	t.Error("VMWARE adapter kind not found")
}

// Test AriaClient.GetResourceKinds
func TestGetResourceKinds(t *testing.T) {
	var response models.ResourceKindResponse
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	err = client.GetResourceKinds("VMWARE", &response)
	require.NoError(t, err)
	require.NotEmpty(t, response.ResourceKind)
	for _, kind := range response.ResourceKind {
		if kind.Key == "VirtualMachine" {
			return
		}
	}
	t.Error("VirtualMachine resource kind not found")
}

// Test AriaClient.GetMetrics
func TestGetMetrics(t *testing.T) {
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	query := models.ResourceStatsRequest{
		ResourceId:         []string{"dd3f76cc-4c44-4e3b-913a-17af826d8d28"},
		StatKey:            []string{"cpu|demandpct"},
		Begin:              (time.Now().Unix() - 86400) * 1000,
		End:                time.Now().Unix() * 1000,
		IntervalType:       "MINUTES",
		IntervalQuantifier: 5,
		RollUpType:         "AVG",
	}
	response := models.ResourceStatsResponse{}
	err = client.GetMetrics(&query, &response)
	require.NoError(t, err)
}
