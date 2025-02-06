package models

type CompiledQuery struct {
	ResourceQuery ResourceRequest `json:"resourceQuery"`
	//OrTerms        *OrTerm           `json:"orTerms,omitempty"`
	Metrics []string `json:"metrics"`
	//Aggregation    *AggregationSpec  `json:"aggregation,omitempty"`
	//SlidingWindow  *SlidingWindowSpec `json:"slidingWindow,omitempty"`
}
