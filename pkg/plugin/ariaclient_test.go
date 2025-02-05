package plugin

import (
	"os"
	"testing"

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
	var response ResourceResponse
	client, err := newAuthenticatedClient()
	require.NoError(t, err)
	request := ResourceRequest{
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
	var response AdapterKindResponse
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
	var response ResourceKindResponse
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
