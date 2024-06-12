/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the 
Aria Operations plug-in for Grafana project. You may not use this file except 
in compliance with the License.

BSD-2 License

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

Expression = 
  "expr" LP Additive RP /
  Query

Query = 
  _ type: TypeSpec Dot 
  instances: InstanceSelectors 
  _ metrics: (MetricSelector)? 
  aggregation: (Aggregation)? 
  slidingWindow: (SlidingWindow)? { return { type, instances, metrics, slidingWindow, aggregation }}

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
UnaryFunction = name: UnaryFunctionName  LP arg: Identifier RP { return { name: name.toUpperCase(), arg: [ arg ] } }
BinaryFunction = name: BinaryFunctionName LP  arg0: Identifier Comma arg1: LiteralValue RP { return { name: name.toUpperCase(), arg: [ arg0, arg1 ] } }
InfixExpression = left: Identifier _ operator: Operator _ right: LiteralValue { return { name: operator, arg: [ left, right ] }}
LiteralValue = LiteralString / Number / LP list: LiteralValueList RP  { return list }
LiteralValueList = first: LiteralValue theRest: LiteralValueNode* { return [ first, ...theRest ] }
LiteralValueNode = Comma data: LiteralValue { return data }

Aggregation = TwoParamAggregation / OneParamAggregation
OneParamAggregation = Dot type: OneParamAggregationOp LP properties: IdentifierList? RP { return { type, properties } }
OneParamAggregationOp = 
    "avg" /
    "min" /
    "max" /
    "sum" /
    "count" /
    "variance" /
    "stddev"
TwoParamAggregation = Dot type: TwoParamAggregationOp LP parameter: Number properties: (Comma identifiers: IdentifierList {return identifiers})? RP { return { type, parameter, properties } }
TwoParamAggregationOp = 
    "percentile"

SlidingWindow = Dot type: SlidingWindowOp LP duration: TimeSpec shift: (Comma value: Boolean { return value }) ? RP { return { type, params: { duration, shift }}}
SlidingWindowOp = 
  "mavg" /
  "mstddev" /
  "mvariance" /
  "mmedian" /
  "mmax" /
  "mmin" /
  "msum" /
  "mexpavg" /
  "mgaussian"

TimeSpec = timequantity: Number timeunit: TimeUnit { return timequantity * timeunit }
TimeUnit = 
  "s" { return 1000 } /
  "m" { return 60 * 1000 } /
  "h" { return 60 * 60 * 1000 } /
  "d" { return 24 * 60 * 60 * 1000 } /
  "w" { return 7 * 24 * 60 * 60 * 1000 } /
  "y" { return 365 * 24 * 60 * 60 * 1000 }

Operator = OpEQ / OpNE / OpLT / OpGT / OpLT_EQ / OpGT_EQ / OpIN / OpNOT_IN
OpEQ = "=" { return "EQ" }
OpNE = "!=" { return "NE" }
OpLT = "<" { return "LT" }
OpGT = ">" { return "GT" }
OpLT_EQ = "<=" { return "LT_EQ" }
OpGT_EQ = ">="{ return "GT_EQ" }
OpIN = "in" { return "IN" }
OpNOT_IN = "not in" { return "NOT_IN" }

UnaryFunctionName = 
    ("not exists" /
    "exists" ) { return text().replace(" ", "_").toUpperCase()}

BinaryFunctionName = 
    ("contains" / 
    "starts_with" / 
    "ends_with" / 
    "not starts_with" / 
    "not ends_with" / 
    "not contains" / 
    "regex" / 
    "not regex") { return text().replace(" ", "_").toUpperCase()}
    
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

// Metric arthimetic
Additive = 
  left: Multiplicative operator: ("+" / "-") Multiplicative { return { left, operator, right }} /
  left: Multiplicative { return { left } }
Multiplicative = 
  left: Unary operator: ( "*" / "/" ) right: Multiplicative { return { left, operator, right }} /
  left: Unary { return { left }} /
  left: LP Additive RP { return { left }}
Unary = 
  "-" left: ExpressionAtom { return { operator: "NEGATE", left } } /
  left: ExpressionAtom { return left }
ExpressionAtom = left: Identifier { return { metric: left } } / 
  left: Number { return { constant: left } }

Dot = _ "." _
Comma = _ "," _
LP = _ "(" _
RP = _ ")" _
LCURLY = _ "{" _
RCURLY = _ "}" _ 

Number ="number" Integer / Float
Integer "integer" = _ DIGIT+ { return parseInt(text(), 10); }
Float "number" = _ DIGIT + ("." DIGIT +)* { return parseFloat(text()) }
Boolean = _ value: (True / False) _ { return value }
True = "true" { return true }
False = "false" { return false }

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
HEXDIG = [0-9a-f]