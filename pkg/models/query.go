package models

// Query as passed down from the UI
type AriaOpsQuery struct {
	ResourceKind string `json:"resourceKind"`
	ResourceId   string `json:"resourceId"`
	ResourceName string `json:"resourceName"`
	Metric       string `json:"metric"`
	QueryText    string `json:"queryText"`
	AdvancedMode bool   `json:"advancedMode"`
}
