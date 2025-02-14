package grammar

const (
	UnaryCondition = iota
	StringCondition
	DoubleCondition
)

type Condition struct {
	Type                int
	ConjunctiveOperator string
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

func (c *Condition) WithConjunctive(op string) *Condition {
	c.ConjunctiveOperator = op
	return c
}
