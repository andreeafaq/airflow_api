const config = require('./connector').config
const hasProperty = require('./commonFunctions').hasProperty
const isEmptyObj = require('./commonFunctions').isEmptyObj
const difference = require('./commonFunctions').difference
const intersect = require('./commonFunctions').intersect
const isArray = require('./commonFunctions').isArray
const settings = require('./settings.json')
const fieldsMapping =  Object.entries(settings).filter(([k, v]) => v.output).reduce((obj, [k, v]) => {
    obj[k] = v.definition
    return obj
}, {})


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
    const selectFields = Object.entries(fieldsMapping).map(([k, v]) => ([k, `${v} AS \`${k}\``])).reduce((obj, [k, v]) => {
        obj[k] = (typeof(v) == 'string') ? v.trim() : v
        return obj
    }, {})
    const removeFields = difference(Object.keys(selectFields), [...outputFields, ...filterFields, ...orderByFields])
    if (removeFields.length)
        for (const removeField of removeFields)
            delete selectFields[removeField]
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
        orderElement[0] = '`' + orderElement[0] + '`'
        returnValue.push(orderElement.join(' '))
    }
    return returnValue.join(', ')
}

const handlerFilters = (filterField, filterValues, isTimestamp=false) => {
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
        let loopValue = `${fieldsMapping[filterField]} `
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
    const requestQuery = [...Object.entries(req.query)].reduce((obj, [k, v]) => {
        obj[k.trim()] = (typeof(v) == 'string') ? v.trim() : v
        return obj
    }, {})
    req.query = requestQuery
    let outputFields = (hasProperty(req.query, 'OutputFields')) ? req.query.OutputFields : settings.OutputFields.default
    outputFields = outputFields.split(',')
    outputFields = outputFields.map(el => {return el.trim()})
    let filterFields = Object.keys(req.query)
    filterFields = filterFields.map(el => {return el.trim()})
    let customFields = Object.entries(settings).filter(([k, v]) => (!v.output && v.operator)).map(([k, v]) => k)
    customFields = intersect(customFields, filterFields)
    if (customFields.length)
        for (let customField of customFields)
            if ((filterFields.includes(customField)) && (!filterFields.includes(settings[customField].field)))
                filterFields = filterFields.map(e => (e == customField) ? settings[customField].field : customField)
    filterFields = difference(filterFields, [...['OutputFields', 'OrderBy'], ...customFields])
    const orderBy = (hasProperty(req.query, 'OrderBy')) ? req.query.OrderBy : settings.OrderBy.default
    let orderByFields = []
    for (let orderElement of orderBy.split(',')) {
        orderElement = orderElement.trim()
        orderElement = orderElement.split(':')
        orderElement = orderElement.map(el => {return el.trim()})
        orderByFields.push(orderElement[0])
    }
    q = q.replace('<outputFields>', handlerOutputFields(outputFields, filterFields, orderByFields))
    q = q.replace('<orderBy>', handlerOrderBy(orderBy))
    let filters = []
    for (param of Object.keys(req.query))
        if (!['OutputFields', 'OrderBy'].includes(param)) {
            let field = settings[param]
            let isTimestamp = (field.isTimestamp) ? field.isTimestamp : false
            if (!field.field)
                filters = [...filters, ...handlerFilters(param, req.query[param], isTimestamp)]
            else {
                const filterFiled = field.field
                const operator = field.operator
                filters = [...filters, ...handlerFilters(filterFiled, `${operator}:${req.query[param]}`, isTimestamp)]
            }
        }
    if (filters.length == 0) {
        const numberOfDaysAgo = config.API_DEFAULT_START_DATE_DAYS_AGO
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