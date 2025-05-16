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
*/package grammar

func (p *QueryParser) Push(item any) {
	p.stack = append(p.stack, item)
}

func (p *QueryParser) PushStringIntoList(item string) {
	p.Push(append(p.Pop().([]string), item))
}

func (p *QueryParser) PushConditionIntoList(item *Condition) {
	p.Push(append(p.Pop().([]*Condition), item))
}

func (p *QueryParser) Pop() any {
	if len(p.stack) == 0 {
		panic("Stack underflow")
	}
	l := len(p.stack)
	tmp := p.stack[l-1]
	p.stack = p.stack[0 : l-1]
	return tmp
}

func (p *QueryParser) PopString() string {
	return p.Pop().(string)
}

func (p *QueryParser) PopFloat() float64 {
	return p.Pop().(float64)
}

func (p *QueryParser) PopList() []string {
	return p.Pop().([]string)
}

func (p *QueryParser) PopConditions() []*Condition {
	return p.Pop().([]*Condition)
}

func (p *QueryParser) PopCondition() *Condition {
	return p.Pop().(*Condition)
}
