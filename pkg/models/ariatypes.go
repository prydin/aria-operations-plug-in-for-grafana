package models

type AuthRequest struct {
	Username   string `json:"username,omitempty"`
	Password   string `json:"password,omitempty"`
	AuthSource string `json:"authSource,omitempty"`
}

type AuthResponse struct {
	Token string `json:"token,omitempty"`
}

type Condition struct {
	DoubleValue float64 `json:"doubleValue,omitempty"`
	StringValue string  `json:"stringValue,omitempty"`
	Key         string  `json:"key,omitempty"`
	Operator    string  `json:"operator,omitempty"`
}

type FilterSpec struct {
	Conditions          []Condition `json:"conditions,omitempty"`
	ConjunctionOperator string      `json:"conjunctionOperator,omitempty"`
}

type TagSpec struct {
	Category string `json:"category,omitempty"`
	Name     string `json:"name,omitempty"`
}

type ResourceRequest struct {
	AdapterKind        []string     `json:"adapterKind,omitempty"`
	ResourceKind       []string     `json:"resourceKind,omitempty"`
	ResourceId         []string     `json:"resourceId,omitempty"`
	Regex              []string     `json:"regex,omitempty"`
	Name               []string     `json:"name,omitempty"`
	Id                 []string     `json:"id,omitempty"`
	PropertyConditions []FilterSpec `json:"propertyConditions,omitempty"`
	StatConditions     []FilterSpec `json:"statConditions,omitempty"`
	ResourceState      []string     `json:"resourceState,omitempty"`
	ResourceStatus     []string     `json:"resourceStatus,omitempty"`
	ResourceHealth     []string     `json:"resourceHealth,omitempty"`
	ResourceTag        []TagSpec    `json:"resourceTag,omitempty"`
}

type Resource struct {
	Identifier  string `json:"identifier,omitempty"`
	ResourceKey struct {
		Name string `json:"name,omitempty"`
	} `json:"resourceKey,omitempty"`
}

type ResourceResponse struct {
	ResourceList []Resource `json:"resourceList,omitempty"`
}

type KeyNamePair struct {
	Key  string `json:"key,omitempty"`
	Name string `json:"name,omitempty"`
}

type AdapterKindResponse struct {
	AdapterKind []KeyNamePair `json:"adapter-kind,omitempty"` // TODO: adapter-kind
}

type ResourceKindResponse struct {
	ResourceKind []KeyNamePair `json:"resource-kind,omitempty"` // TODO: respource-kind
}

type ResourceKindAttribute struct {
	Key         string `json:"key,omitempty"`
	Description string `json:"description,omitempty"`
}

type ResourceKindAttributeResponse struct {
	ResourceTypeAttributes []ResourceKindAttribute `json:"resourceTypeAttributes,omitempty"`
}

type Stat struct {
	Timestamps []int64 `json:"timestamps,omitempty"`
	StatKey    struct {
		Key string `json:"key,omitempty"`
	} `json:"statKey,omitempty"`
	Data []float64 `json:"data,omitempty"`
}

type ResourceStats struct {
	ResourceId string `json:"resourceId,omitempty"`
	StatList   struct {
		Stat []Stat `json:"stat,omitempty"`
	} `json:"statList,omitempty"` // TODO: stat-list
}

type ResourceStatsRequest struct {
	ResourceId         []string `json:"resourceId,omitempty"`
	StatKey            []string `json:"statKey,omitempty"`
	Begin              int64    `json:"begin,omitempty"`
	End                int64    `json:"end,omitempty"`
	RollUpType         string   `json:"rollUpType,omitempty"`
	IntervalType       string   `json:"intervalType,omitempty"`
	IntervalQuantifier int64    `json:"intervalQuantifier,omitempty"`
}

type ResourceStatsResponse struct {
	Values []ResourceStats `json:"values,omitempty"`
}

type ResourcePropertiesRequest struct {
	ResourceIds  []string `json:"resourceIds,omitempty"`
	PropertyKeys []string `json:"propertyKeys,omitempty"`
}

type ResourceProperties struct {
	ResourceId       string   `json:"resourceId,omitempty"`
	PropertyContents struct { // TODO: property-contents
		PropertyContent []struct { // TODO: property-content
			StatKey    string    `json:"statKey,omitempty"`
			Timestamps []int64   `json:"timestamps,omitempty"`
			Values     []string  `json:"values,omitempty"`
			Data       []float64 `json:"data,omitempty"`
		} `json:"propertyContent,omitempty"`
	} `json:"propertyContents,omitempty"`
}

type ResourcePropertiesResponse struct {
	Values []ResourceProperties `json:"values,omitempty"`
}

type AuthSourceResponse struct {
	Sources []KeyNamePair `json:"sources,omitempty"`
}
