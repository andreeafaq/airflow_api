// 1. Defaut GET
// Get last 14 days by StartDateTs ("WHERE StartDateTs >= <14_days_ago_at_00h00>")
// Default response columns: RunID, ProcesID, System, Table, JobType, State, StartDateTs, EndDateTs, ReportDt, JobDurationSec, TaskDurationSec
// curl -X GET http://localhost:8000/api/etl/monitoring

// 2. GET with "ReportDtAfter":
// Get with "WHERE ReportDt >= <some_date>":
// curl -X GET http://localhost:8000/api/etl/monitoring?ReportDtAfter=2022-11-07
// ReportDtAfter cannot be used more than once per API call ("?ReportDtAfter=2022-11-01&?ReportDtAfter=2022-11-07" is not supported)
// The bellow produces the same result as "ReportDtAfter", but "ReportDt" and "ReportDtAfter" cannot be used together (as part of the same API call):
// curl -X GET http://localhost:8000/api/etl/monitoring?ReportDt=greater_than_or_eq_to:2022-11-07

// 3. GET with customized "OutputFields":
// Possible Output fields are: RunID, ProcesID, System, Table, JobType, State, StartDateTs, EndDateTs, ReportDt, JobDurationSec, TaskDurationSec
// Usage: OutputFields=<field1>,<field2>,<field3>
// If OutputFields is not present in the call, then all the fields listed above will be present in the API response
// Example:
// curl -X GET http://localhost:8000/api/etl/monitoring?OutputFields=ProcesID,Table,ProcesID

// 4. GET with "OrderBy"
// Possible ORDER BY fields: RunID, ProcesID, System, Table, JobType, State, StartDateTs, EndDateTs, ReportDt, JobDurationSec, TaskDurationSec
// Format to use in queries: "OrderBy=StartDateTs" or "OrderBy=StartDateTs:asc" or "OrderBy=StartDateTs:ASC" or "OrderBy=StartDateTs:desc" or "OrderBy=StartDateTs:DESC"
// When the "asc" and / or "desc" is missing (e.g "OrderBy=StartDateTs") then the default "ASC" is used
// Example:
// curl -X GET http://localhost:8000/api/etl/monitoring?OrderBy=StartDateTs:desc
// Multiple Orderby are also allowed using comma as separator, as follows: "OrderBy=StartDateTs:DESC,Table,State" or "OrderBy=StartDateTs:desc,Table:desc,State:asc"
// The ORDER BY logic can be used in combination with any other query parameters.
// Example in combination with OUTPUT FIELDS:
// curl -X GET http://localhost:8000/api/etl/monitoring?OutputFields=ProcesID,Table,ProcesID&OrderBy=StartDateTs:desc
// Example in combination with ReportDtAfter:
// curl -X GET http://localhost:8000/api/etl/monitoring?ReportDtAfter=2022-11-07&OrderBy=StartDateTs:desc
// Example in combination with OUTPUT FIELDS and ReportDtAfter:
// curl -X GET http://localhost:8000/api/etl/monitoring?ReportDtAfter=2022-11-07&OutputFields=ProcesID,Table,ProcesID&OrderBy=StartDateTs:desc

// 5. GET with other filters:
// The other possible query parameters for filtering are: StartDateTs, EndDateTs, ReportDt, State, JobType, System, Table
// The filters StartDateTs and EndDateTs are timestamps with the following imposed format "YYYY-MM-DD hh:mm:ss"
// When used in API calls such timestamps needs to be URL encoded
// For instance "2022-11-07 13:30:00" becomes "2022-11-07%2013%3A30%3A00" when URL encoded
// The filters "ReportDt" and "ReportDtAfter" are dates with the following imposed format "YYYY-MM-DD"
// The "value" aspect of the "filter=value" in the API calls accounts for 2 possibilities: (1) "operator:value(s)" or simply (2) "value".
// In case of the filter value being used as version (1) "operator:value(s)", the "operator" can have one of the following values:
// There are 8 allowed values for the operators: "eq", "not_eq", "lower_than", "lower_than_or_eq_to", "greater_than", "greater_than_or_eq_to", "is_in", "not_in", "like", "not_like"
// The "like" and "not_like" work with the "%" wildcard for the GET queries. For example the bellow searches for StartDateTs LIKE "2022-11-1% 00%":
// curl -X GEThttp://localhost:8000/api/etl/monitoring?Table=GlbStaff&StartDateTs=like:2022-11-1%25%2000%25
// Example of an operator usage ("WHERE StartDateTs >= 2022-11-07 13:30:00")
// curl -X GET http://localhost:8000/api/etl/monitoring?StartDateTs=greater_than_or_eq_to:2022-11-07%2013%3A30%3A00
// The StartDateTs, EndDateTs and ReportDt allow the usage of any of the 8 allowed operators
// The other filters (State, JobType, System, Table)  allow only 4 of these operators: eq, not_eq, is_in, not_in
// When the "value" aspect of the "filter=value" in the API calls does not contain an operator (simply (2) "value"), then the assumed operator will be the equiality "eq"
// When the operator has on the the 2 values "is_in" or "not_in" then the part that comes after the colon in the query (e.g. "is_in:value(s)" ) can be comma separated
// Example of the "is_in" operator usage with comma separated values:
// curl -X GET http://localhost:8000/api/etl/monitoring?Table=is_in:CusEntryHeader,CusMAWB
// Example of filters usage without separators
// curl -X GET http://localhost:8000/api/etl/monitoring?State=failed
// Multiple filters can be used in the same query:
// curl -X GET http://localhost:8000/api/etl/monitoring?State=success&Table=is_in:CusEntryHeader,CusMAWB&StartDateTs=lower_than_or_eq_to:2022-11-07%2013%3A30%3A00&StartDateTs=greater_than_or_eq_to:2022-10-15%2017%3A26%3A42
// Any filter can be used in combination with "OutputFields"and/or with "OrderBy":
// curl -X GET http://localhost:8000/api/etl/monitoring?State=success&Table=is_in:CusEntryHeader,CusMAWB&StartDateTs=lower_than_or_eq_to:2022-11-07%2013%3A30%3A00&StartDateTs=greater_than_or_eq_to:2022-10-15%2017%3A26%3A42&OutputFields=ProcesID,Table,ProcesID&OrderBy=StartDateTs:desc,Table:desc,State:asc
// Using the same operator twice for the same filter is not allowed. For example the bellow call produces an error:
// curl -X GET http://localhost:8000/api/etl/monitoring?Table=CusEntryHeader&Table=CusMAWB
// Use the following instead:
// curl -X GET http://localhost:8000/api/etl/monitoring?Table=is_in:CusEntryHeader,CusMAWB
// By the same logic the following is also not allowed, bacause "StartDateTs" is used twice with the same operator "lower_than_or_eq_to"
// curl -X GET http://localhost:8000/api/etl/monitoring?StartDateTs=lower_than_or_eq_to:2022-11-07%2013%3A30%3A00&StartDateTs=lower_than_or_eq_to:2022-10-15%2017%3A26%3A42