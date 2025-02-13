package grammar

const (
	UnaryCondition = iota
	StringCondition
	DoubleCondition
)

const (
	AndConjunction = iota
	OrConjunction
)

type Condition struct {
	Type                int
	ConjunctionOperator int
	DoubleValue         float64
	StringValue         string
	Key                 string
	Operator            string
}

type RawQuery struct {
	ResourceKinds      []string
	ResourceIds        []string
	Name               []string
	Regex              []string
	Metrics            []string
	Health             []string
	Status             []string
	State              []string
	MetricConditions   []Condition
	PropertyConditions []Condition
}

func (c *Condition) WithConjunction(op int) *Condition {
	c.ConjunctionOperator = op
	return c
}
