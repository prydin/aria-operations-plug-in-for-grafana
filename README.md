# Aria Operations (vrops) plugin for Grafana

Grafana datasource plugin for reading metrics from VMware Aria Operations (formerly vRealize Operations). This is a full-featured datasource capable of accessing any metric in Aria Operations
either through a simple list picker or a rich query language

## Important Notice

This is currently an unsigned plugin that has not been reviewed or endorsed by Grafana. You may still use it, but you need to do one of the following:

1. Allow Grafana to bypass the signature check for this plugin. You can do that by adding the following line in your configuration file under the `[plugins]` section:
   `allow_loading_unsigned_plugins=vmware-ariaoperations-datasource`. This is generally not recommended and you're doing this at you own risk.
2. Create a private signature as described here: https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/

Unfortunately, this plugin is currently not compatible with Grafana Cloud.

## Quick Start

1. Download the desired release (latest release is always strongly recommended) from here: [releases](../../releases). The file name should be `vmware-ariaoperations-datasource-<version>.zip`
3. Unzip the zip file in your plugin directory (as configured)
4. Restart the Grafana backend
5. Create a data source with the Aria Operations plugin.
6. Fill in user, password and an optional authentication source. If you are using self-signed certs, you may want to check the "Skip TLS Verify" box. Keep in mind that this is unsafe in a non-trusted environment.

## Features

- Access to entire Aria Operations data model, including data from third party plugins, custom collectors and super metrics.
- Real time access to metrics
- Easy installation
- Easy mode: Pick resource type, instance and metrics
- Advanced mode: Full-featured questy language including name matching, regexp matching, conditional filtering on metrics and properties, tag-based filtering, health and status based filtering and more.
- Advanced query editing with syntax highlighting and autocomplete.

## Easy mode

The "Easy Mode" allows you to pick metrics from an adapter type, resource type and instance. Simply start by selecting the adapter type (e.g. vCenter for vSphere metrics) and the resource kind (e.g. Virtual Machine). Then select the resource instance. You can type a partial name to narrow down the list. Finally pick the metric you are interested in.

## Advanced Mode

In Advanded Mode, metrics are accessed through a simple but powerful query language. To activate the advanced mode, just check the "Advanced Mode" checkbox. Provided that you have made a valid metric selection using the drop-down lists, the plugin will compose a query that corresponds to the selection made. This is useful to get a template for a query.

### Query Language

#### The basics

The query language is based on the "filter chain pattern", which is essentially a list of filters that are applied to the data. The basic syntax of a query looks like this:

`resource(<resource type>).<filter-1>[.<filter-2>...<filter-n>].metrics(<metric list>)[.<aggregation]`

For example, to get the `cpu|demandmhz` metric from a virtual machine names "myvm", you would enter the following query:

`resource(VMWARE:VirtualMachine).name("myvm").metrics(cpu|demandmhz)`

This first selects all object the resource kind "VMWARE:VirtualMachine", filters it down to a VM with the name "myvm" and finally extracts the "cpu|demandmhz" metric.

#### Filter stacking

As mentioned above, any combination of filters can be stacked to create arbitrarily complex queries. This is an example of a more complex query:

```
resource(VMWARE:VirtualMachine).
    regex("prod-.*").
    whereMetric(cpu|demandmhz > 10).
    whereHealth(RED).
    whereProperties(contains(summary|guestFullName, "Linux")).
    metric(cpu|demandmhz)
```

In this example, we first get all the Virtual Machines that have a name starting with "prod-", then we select only those with a current CPU demand greater than 10 MHz, then only those whose health status is "RED" and finally the VMs that have a guest name containing the string "Linux". You may view this as a stream of data passing through a series of filters successively narrowing down the number of Virtual Machines for which metrics are obtained.

#### Filter types

| name            | parameters                                           | description                                                                                                           |
| --------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| all             | N/A                                                  | Returns all resources without any filtering. Use with caution, as the number of returned resources may be very large! |
| id              | An internal UUID                                     | Returns zero or one resources with the provided internal UUID                                                         |
| name            | A resource name                                      | Returns zero or one resource with an exact match of the parameter against a resource name                             |
| regex           | A regular expression                                 | Returns all resources with names that match the provided regular expression                                           |
| whereHealth     | A list of health statuses (RED, GREEN, YELLOW, GRAY) | Returns all resources that match any of the health statuses provided                                                  |
| whereState      | A list of resource states                            | Returns all resources with the provided states                                                                        |
| whereStatus     | A list of resource statuses                          | Returns all resources with the provided statuses                                                                      |
| whereProperties | A conditional expression (see below)                 | Returns all resources with properties that match the conditional expression                                           |
| whereMetrics    | A conditional expression (see below)                 | Returns all resources with metrics that match the conditional expression                                              |

### Conditional expressions

The `whereProperties` and `whereMetrics` filters support complex conditional expressions based on comparison operators or built-in functions.

#### Comparisons

Conditional expressions may contain comparisons in the form <metric or property> <comparison operator> <numeric or string literal>, such as `cpu|utilization > 10` or `confg|os|name = "Ubuntu"`.

Valid comparison operators are as follows
| Operator | Description |
| - | - |
| = | Equals |
| != | Does not equal |
| > | Greater than (only valid for numbers) |
| >= | Greater than or equal (only valid for numbers) |
| < | Less than (only valid for numbers) |
| <= | Less than or equal (only valid for numbers) |

#### Built-in functions

In addition to the comparison operators, the query language supports built-in functions for more advanced comparisons.

| Name        | Parameters                    | Descrption                                                                        |
| ----------- | ----------------------------- | --------------------------------------------------------------------------------- |
| exists      | Metric or property name       | Return true if the metric or property exists                                      |
| contains    | Property name, literal string | Returns true if the property value contains the literal string                    |
| starts_with | Property name, literal string | Returns true if the property value starts with the literal string                 |
| ends_with   | Property name, literal string | Returns true if the property value ends with the literal string                   |
| regex       | Property name, literal string | Returns true if the property value matches the regexp given in the literal string |

#### Boolean Operators

Multiple conditions can be stringed together using boolean operator `and`, `or` and `not`.

Limitations:

- `and` and `or` cannot be mixed in a conditional expression.
- `not` can only be used in front of functions.

### Aggregation

When a query returns multiple time series, they can be aggregated into sums, averages, standard deviations etc. This can be done either across the entire dataset to
generate a single timeseries, or by grouping resources by properties. For example, if you want calculate a single average across all hosts, you would use the
`avg` keyword without any parameters.

```
resource(VMWWARE:HostSystem).all().metric(cpu|demand).avg()
```

If you wanted the same average, but grouped by cluster, you would pass the `summary|parentCluster` to the `avg` function.

```
resource(VMWWARE:HostSystem).all().metric(cpu|demand).avg(summary|parentCluster)
```

#### Calculation details

Aggregations are applied per timestamp. Data is first grouped into timeslots, then grouped by any properties specified and the aggregation is applied on each resulting group.

#### Available aggregations

The following aggregations are currently available.
| Name | Description |
| - | - |
| avg | Average of all values in a group |
| count | Number of values present in a group |
| sum | Sum of all values in a group |
| min | The minimum of all values in a group |
| max | The maximum of all values in a group |
| stddev | Standard deviaton across all values in a group |
| variance | Variance across all values in a group |
| percentile(n) | The n:th percentile for the group

### Sliding window functions

Sliding window functions are typically used for smoothing or enhancing a time series. They work using a "lag", i.e. a period of time to look back and apply their function.
For example, a sliding window average with a lag of one hour will look at the one hour of data prior to the current sample and calculate an average of those samples.
This is repeated for each sample in the series. The following sliding window functions are available:
| Name | Description |
| - | - |
| mavg(lag [, shift]) | Moving average |
| mmax(lag) [, shift] | Moving maximum |
| mmedian(lag [, shift]) | Moving median. Useful for removing outliers |
| mmin(lag [, shift]) | Moving minimum |
| mstddev(lag [, shift]) | Moving standard deviation |
| msum(lag [, shift]) | Moving sum |
| mvariance(lag [, shift]) | Moving variance |
| mexp(lag [, shift]) | Exponentially weighted moving average |
| mgaussian(lag [, shift]) | Moving Gaussian average |

The `shift` parameter is used to correct the lag that's inherent in moving averages and smoothing kernels. It's useful when
creating a smoothed graph that follows the original data closely.

In most cases, `mgaussian` produces the best and smoothest fit to any graph. The only downside is that it's computationally
demanding, but unless you are processing years worth of data, the delay should be minimal.

Note that if aggregations are used, moving window functions must be applied after any aggregations.

#### Lag specifiers

Lag is specified using a quantity and a time unit. Available units are `s`, `m`, `h`, `d`, `w`, `y` for second, minute, hour, day and year.

### Example queries

Get CPU demand for all hosts

```
resource(VMWARE:HostSystem).all().metrics(cpu|demandmhz)
```

Get CPU demand and memory demand from virtual machines with a CPU demand of more than 20 MHz and memory demand > 1,000,000kB

```
resource(VMWARE:VirtualMachine).
    whereMetric(cpu|demandmhz > 20 and mem|host_demand > 1000000).
    metrics(cpu|demandmhz, mem|hostdemand)
```

Get CPU demand for all virtual machines where the name starts with "prod-", the parent cluster is "cluster1" and the full guest name does not contain the string "Linux"

```
resource(VMWARE:VirtualMachine).
    regex("prod-.*").
    whereProperties(summary|parentCluster = "cluster1" and not contains(summary|fullGuestName, "Linux").
    metrics(cpu|demandmhz)
```

Get CPU demand for all hosts and smooth the graph using a moving median with a 1 hour lag

```
resource(VMWARE:HostSystem).all().metrics(cpu|demandmhz).mmedian(lag)
```

### Known issues

Certain combinations of operators are not supported by Aria Operations and you might see an error message saying `Invalid request... #1 violations found`. If this happens, try to rewrite your query a different way.

### Autocompletion

Since the data model of Aria Operations is fairly large and complex, context sensitive autocomplete greatly improves the usability of the query editor. The autocomplete is context sensitive, so, for example when you are typing inside a metric-based filter, it will suggest names of metrics for the resource type you are working on.

Autocomplete can be triggered either by simply typing the first few characters or it can be forced by pressing Ctrl-Space.

Known issues: The first time data is fetched from the server, the autocomplete may time out. To fix this, press Ctrl-Space to reload the list.
