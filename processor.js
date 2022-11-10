const hasProperty = require('./commonFunctions').hasProperty
const isEmptyObj = require('./commonFunctions').isEmptyObj
const difference = require('./commonFunctions').difference
const isArray = require('./commonFunctions').isArray



const requestInitializer = (req) => {
    let request = {}
    if ((hasProperty(req, 'body')) && (!isEmptyObj(req.body)))
        request.body = req.body
    if ((hasProperty(req, 'params')) && (!isEmptyObj(req.params)))
        request.params = req.params
    if ((hasProperty(req, 'query')) && (!isEmptyObj(req.query)))
        request.query = req.query
    return request
}

const handlerOutputFields = (outputFields, filterFields, orderByFields) => {
    const selectFields = {
        'RunID': 'CAST(id AS CHAR(50)) AS RunID',
        'ProcesID': 'NULL AS ProcesID',
        'System': "SUBSTRING_INDEX(SUBSTRING_INDEX(dag_id,'_',2),'_',-1) AS `System`",
        'Table': "SUBSTRING_INDEX(SUBSTRING_INDEX(dag_id,'_',3),'_',-1) AS `Table`",
        'JobType': `SUBSTRING_INDEX(dag_id,'_',1) AS JobType`,
        'State': 'state AS State',
        'StartDateTs': 'start_date AS StartDateTs',
        'EndDateTs': 'end_date AS EndDateTs',
        'ReportDt': 'DATE(start_date) AS ReportDt',
        'JobDurationSec': 'CAST(TIMESTAMPDIFF(SECOND, start_date, end_date) AS CHAR(150)) AS JobDurationSec',
        'TaskDurationSec': 'CAST(TIMESTAMPDIFF(SECOND, start_date, end_date) AS CHAR(150)) TaskDurationSec'
    }
    if (outputFields.length > 0)
        for (const selectField of Object.keys(selectFields))
            if ((!outputFields.includes(selectField)) && (!filterFields.includes(selectField)) && (!orderByFields.includes(selectField)))
                delete selectFields[selectField]
    return Object.values(selectFields).join(', ')
}

const handlerOrderBy = (orderBy) => {
    orderBy = orderBy.split(',')
    orderBy = orderBy.map(el => {return el.trim()})
    let returnValue = []
    for (let orderElement of orderBy) {
        orderElement = orderElement.split(':')
        orderElement = orderElement.map(el => {return el.trim()})
        if ((orderElement.length == 2) && (orderElement[1] == ''))
            orderElement[1] = 'ASC'
        else if (orderElement.length == 1)
            orderElement[1] = 'ASC'
        else
            orderElement[1] = orderElement[1].toUpperCase()
        if (['System', 'Table'].includes(orderElement[0]))
            orderElement[0] = ['`', orderElement[0], '`'].join('')
        returnValue.push(orderElement.join(' '))
    }
    return returnValue.join(', ')
}

const handlerFilters = (filterField, filterValues, isTimestamp=false) => {
    const filterMapping = {
        RunID: 'CAST(id AS CHAR(50))',
        ProcesID: 'NULL',
        System: "SUBSTRING_INDEX(SUBSTRING_INDEX(dag_id,'_',2),'_',-1)",
        Table: "SUBSTRING_INDEX(SUBSTRING_INDEX(dag_id,'_',3),'_',-1)",
        JobType: "SUBSTRING_INDEX(dag_id,'_',1)",
        State: 'state',
        StartDateTs: 'start_date',
        EndDateTs: 'end_date',
        ReportDt: 'DATE(start_date)',
        JobDurationSec: 'CAST(TIMESTAMPDIFF(SECOND, start_date, end_date) AS CHAR(150))',
        TaskDurationSec: 'CAST(TIMESTAMPDIFF(SECOND, start_date, end_date) AS CHAR(150))',
    }
    let returnValue = []
    if (!isArray(filterValues))
        filterValues = [filterValues]
    for (const filterValue of filterValues) {
        let modifiedFilterValue = filterValue
        if (isTimestamp) {
            const tsRegexColon = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/g
            modifiedFilterValue = modifiedFilterValue.replace(tsRegexColon, (match) => {
                return match.replace(/:/g, '`')
            })
        }
        let filtSplit = modifiedFilterValue.split(':')
        filtSplit = filtSplit.map(el => {return el.trim()})
        let operation = (filtSplit.length > 1) ? filtSplit.shift() : 'eq'
        let operationRight = filtSplit[0]
        if (isTimestamp) {
            const tsRegexBacktick = /\d{4}-\d{2}-\d{2}\s\d{2}`\d{2}`\d{2}/g
            operationRight = operationRight.replace(tsRegexBacktick, (match) => {
                return match.replace(/`/g, ':')
            })
        }
        if (['is_in', 'not_in'].includes(operation)) {
            operationRight = operationRight.split(',')
            operationRight = operationRight.map(el => {return el.trim()})
            operationRight = `'${operationRight.join("', '")}'`
        } else if (operationRight != 'NULL')
            operationRight = `'${operationRight}'`
        let loopValue = `${filterMapping[filterField]} `
        switch (operation) {
            case 'eq':
                loopValue += `= ${operationRight}`
                break
            case 'not_eq':
                loopValue += `<> ${operationRight}`
                break
            case 'lower_than':
                loopValue += `< ${operationRight}`
                break
            case 'lower_than_or_eq_to':
                loopValue += `<= ${operationRight}`
                break
            case 'greater_than':
                loopValue += `> ${operationRight}`
                break
            case 'greater_than_or_eq_to':
                loopValue += `>= ${operationRight}`
                break
            case 'is_in':
                loopValue += `IN (${operationRight})`
                break
            case 'not_in':
                loopValue += `NOT IN (${operationRight})`
                break
            default:
                throw new Error(`Unsupported operation ${operation} in the query filter ${filterField}`)
        }
        returnValue.push(loopValue)
    }
    return returnValue
}

const sqlBuilder = (req) => {
    let q = 'SELECT <outputFields> FROM dag_run WHERE <filters> ORDER BY <orderBy>'
    let outputFields = (hasProperty(req.query, 'OutputFields')) ? req.query.OutputFields : []
    if (typeof(outputFields) == 'string') {
        outputFields = outputFields.split(',')
        outputFields = outputFields.map(el => {return el.trim()})
    }
    let filterFields = Object.keys(req.query)
    filterFields = filterFields.map(el => {return el.trim()})
    if ((filterFields.includes('ReportDtAfter')) && (!filterFields.includes('ReportDt')))
        filterFields.push('ReportDt')
    filterFields = difference(filterFields, ['OutputFields', 'OrderBy', 'ReportDtAfter'])
    const orderBy = (hasProperty(req.query, 'OrderBy')) ? req.query.OrderBy : 'StartDateTs'
    let orderByFields = []
    for (let orderElement of orderBy.split(',')) {
        orderElement = orderElement.trim()
        orderElement = orderElement.split(':')
        orderElement = orderElement.map(el => {return el.trim()})
        if (['System', 'Table'].includes(orderElement[0]))
            orderElement[0] = ['`', orderElement[0], '`'].join('')
        orderByFields.push(orderElement[0])
    }
    q = q.replace('<outputFields>', handlerOutputFields(outputFields, filterFields, orderByFields))
    q = q.replace('<orderBy>', handlerOrderBy(orderBy))
    let filters = []
    for (param of Object.keys(req.query))
        if (!['OutputFields', 'OrderBy'].includes(param)) {
            let isTimestamp = (['StartDateTs', 'EndDateTs'].includes(param)) ? true : false
            if (param != 'ReportDtAfter')
                filters = [...filters, ...handlerFilters(param, req.query[param], isTimestamp)]
            else
                filters = [...filters, ...handlerFilters('ReportDt', `greater_than_or_eq_to:${req.query[param]}`, isTimestamp)]
        }
    if (filters.length == 0) {
        const numberOfDaysAgo = 14
        const daysAgo = new Date(new Date().setDate((new Date()).getDate() - numberOfDaysAgo)).toISOString().split('T')[0] + ' 00:00:00'
        filters = [...filters, ...handlerFilters('StartDateTs', `greater_than_or_eq_to:${daysAgo}`, true)]
    }
    filters = `(${filters.join(') AND (')})`
    q = q.replace('<filters>', filters)
    return q
}

const responseBuilder = (req, sqlResult) => {
    const request = requestInitializer(req)
    return {
        request: request,
        success: true,
        status: 200,
        response: sqlResult
    }
}


module.exports = {
    requestInitializer: requestInitializer,
    sqlBuilder: sqlBuilder,
    responseBuilder: responseBuilder
}