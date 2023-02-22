Query = 
_ type: TypeSpec Dot 
instances: InstanceSelectors 
_ metrics: MetricSelector 
aggregation: (Aggregation)? { return { type, instances, metrics, aggregation }}

TypeSpec = "resource" LP resourceType: IdentifierList RP { return resourceType }

InstanceSelectors = instanceSelector: InstanceFilterChain { return instanceSelector }
InstanceFilterChain = first: InstanceFilter theRest: (InstanceFilterNode*) { return [ first, ...theRest ]} 
InstanceFilterNode = Dot data: InstanceFilter { return data }
InstanceFilter = 
	All / 
    InstanceId / 
    InstanceName / 
    InstanceRegex / 
    HealthFilter /
    StateFilter /
    StatusFilter /
    TagFilter /
    ComplexInstanceFilter
    
All = type: "all" LP RP { return { type, arg: [] } }
InstanceId = type: "id" LP arg: LiteralStringList RP { return { type, arg } }
InstanceName = type: "name" LP arg: LiteralStringList RP { return { type, arg } }
InstanceRegex = type: "regex" LP arg: RegexpList RP { return { type, arg } }
ComplexInstanceFilter = type: ("whereProperties" / "whereMetrics") LP arg: FilterConditions RP { return { type, arg } }

FilterConditions = first: Term _ theRest: TermNode* { return [ first, ...theRest ] }
TermNode = _ conjunctive: ("and" / "or") _ term: Term { return { ...term, conjunctive } }
Term = Function / InfixExpression
Function = UnaryFunction / BinaryFunction
UnaryFunction = name: UnaryFunctionName  LP arg: LiteralValue RP { return { name: name.toUpperCase(), arg: [ arg ] } }
BinaryFunction = name: BinaryFunctionName LP  arg0: Identifier Comma arg1: LiteralString RP { return { name: name.toUpperCase(), arg: [ arg0, arg1 ] } }
InfixExpression = left: Identifier _ operator: Operator _ right: LiteralValue { return { name: operator, arg: [ left, right ] }}
LiteralValue = LiteralString / Number

Aggregation = Dot type: AggregationOp LP properties: IdentifierList? RP { return { type, properties}}
AggregationOp = 
    "avg" /
    "min" /
    "max" /
    "sum" /
    "count" /
    "variance" /
    "stddev"

Operator = OpEQ / OpNE / OpLT / OpGT / OpLT_EQ / OpGT_EQ
OpEQ = "=" { return "EQ" }
OpNE = "!=" { return "NE" }
OpLT = "<" { return "LT" }
OpGT = ">" { return "GT" }
OpLT_EQ = "<=" { return "LT_EQ" }
OpGT_EQ = ">="{ return "GT_EQ" }

UnaryFunctionName = 
    "not exists" /
	"empty" / 
    "exists" / 
    "not empty"

BinaryFunctionName = 
    "like" /
	"in" /
    "not in" / 
    "contains" / 
    "starts_with" / 
    "ends_with" / 
    "not starts_with" / 
    "not ends_with" / 
    "not contains" / 
    "regex" / 
    "not regex" 
    
StateFilter = type: "whereState" LP arg: IdentifierList RP { return { type, arg }}
StatusFilter = type: "whereStatus" LP arg: IdentifierList RP { return { type, arg }}
HealthFilter = type: "whereHealth" LP arg: IdentifierList RP { return { type, arg }}
TagFilter = type: "whereTags" LP arg: IdentifierList RP { return { type, arg }}

MetricSelector = Dot "metrics" LP metrics: IdentifierList _ RP { return metrics }

Characters = [A-Za-z0-9_:|.-]+ { return text() }

Identifier = identifier: ( LiteralString / Characters ) { return identifier }
IdentifierList = first: Identifier theRest: IdentifierNode* { return [ first, ...theRest ] }
IdentifierNode = Comma data: Identifier { return data }

LiteralStringList = first: LiteralString theRest: LiteralStringNode* { return [ first, ...theRest ] }
LiteralStringNode = Comma data: LiteralString { return data }

RegexpList = first: Regexp theRest: RegexpNode* { return [ first, ...theRest ]}
RegexpNode = Comma data: Regexp { return data }
Regexp = Quote chars: (Unescaped / "\\")+ Quote { return chars.join("") }


Dot = _ "." _
Comma = _ "," _
LP = _ "(" _
RP = _ ")" _

Number ="number" Integer / Float
Integer "integer" = _ DIGIT+ { return parseInt(text(), 10); }
Float "number" = _ DIGIT + ("." DIGIT +)* { return parseFloat(text()) }

_ "whitespace" = [ \t\n\r]*

LiteralString "string" = Quote chars:Char* Quote { return chars.join(""); }

Char
  = Unescaped
  / Escape
    sequence:(
        '"'
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

Escape
  = "\\"

Quote
  = '"'

Unescaped
  = [^\0-\x1F\x22\x5C]

// ----- Core ABNF Rules -----

// See RFC 4234, Appendix B (http://tools.ietf.org/html/rfc4234).
DIGIT  = [0-9]
HEXDIG = [0-9a-f]i