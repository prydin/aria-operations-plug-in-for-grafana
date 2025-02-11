package grammar

type RawQuery struct {
	ResourceKinds []string
	ResourceIds   []string
	Name          []string
	Regex         []string
	Metrics       []string
	Health        []string
	Status        []string
	State         []string
}
