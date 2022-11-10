const difference = require('./commonFunctions').difference
const isArray = require('./commonFunctions').isArray

const validateOutputFields = (outputFields) =>{
    if (isArray(outputFields))
        throw new Error('Usage of multiple OutputFields in the same query is not supported')
    const allowedFields = [
        'RunID',
        'ProcesID',
        'System',
        'Table',
        'JobType',
        'State',
        'StartDateTs',
        'EndDateTs',
        'ReportDt',
        'JobDurationSec',
        'TaskDurationSec',
    ]
    outputFields = outputFields.split(',')
    outputFields = outputFields.map(el => {return el.trim()})
    const validate = difference(outputFields, allowedFields)
    if (validate.length > 0)
        throw new Error(`Unsupported output fields: ${JSON.stringify(validate)}`)
    return true
}

const validateOrderBy = (orderBy) => {
    if (isArray(orderBy))
        throw new Error('Usage of multiple OrderBy in the same query is not supported')
    const allowedOrderFields = [
        'RunID',
        'ProcesID',
        'System',
        'Table',
        'JobType',
        'State',
        'StartDateTs',
        'EndDateTs',
        'ReportDt',
        'JobDurationSec',
        'TaskDurationSec'
    ]
    orderBy = orderBy.split(',')
    orderBy = orderBy.map(el => {return el.trim()})
    let validate = []
    for (const o of orderBy) {
        let orderElement = o.split(':')
        orderElement = orderElement.map(el => {return el.trim()})
        if ((orderElement.length == 2 ) && (orderElement[1] == ''))
            orderElement[1] = 'ASC'
        const validateElement = allowedOrderFields.includes(orderElement[0])
        if (!validateElement)
            validate.push(o)
        else if (orderElement.length > 2)
            validate.push(o)
        else if ((orderElement.length == 2 ) && (!['ASC', 'DESC'].includes(orderElement[1].toUpperCase())))
                validate.push(o)
    }
    if (validate.length > 0) {
        throw new Error(`Unsupported OrderBy fields: ${JSON.stringify(validate)}`)
    } else {
        return true
    }
}

const vallidateDate = (value, isTimestamp=true) => {
    const regex = isTimestamp
                  ? /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/
                  : /^\d{4}-\d{2}-\d{2}$/
    if (regex.test(value)) {
        try {
            if ((new Date(Date.parse(value))).toString() == 'Invalid Date')
                return false
            else
                return true
        } catch(e) {
           return false
        }
    } else
        return false
}

const validateOther = (filterName, filterValues, allowedOperators=null, validateDate=0) => {
    if (!isArray(filterValues))
        filterValues = [filterValues]
    filterCombinations = []
    for (const filterValue of filterValues) {
        let isTimestamp = false
        let modifiedFilterValue = filterValue
        if (validateDate != 0)
            if ([1, '1', true, 'true', 'TRUE', 'True'].includes(validateDate))
                isTimestamp = true
        if (isTimestamp) {
            const tsRegexColon = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/g
            modifiedFilterValue = modifiedFilterValue.replace(tsRegexColon, (match) => {
                return match.replace(/:/g, '`')
            })
        }
        let filtSplit = modifiedFilterValue.split(':')
        filtSplit = filtSplit.map(el => {return el.trim()})
        for (const f of filtSplit)
            if (f == '')
                throw new Error(`Unsupported format for ${filterName}: ${filterValue}`)
        if (filtSplit.length > 2)
            throw new Error(`Unsupported format for ${filterName}: ${filterValue}`)
        if ((filtSplit.length == 2) && (allowedOperators) && (allowedOperators.length > 0) && (!allowedOperators.includes(filtSplit[0])))
            throw new Error(`Unsupported format for ${filterName}: ${filterValue}`)
        if (validateDate != 0) {
            let dateValues = (filtSplit.length == 1) ? filtSplit[0] : filtSplit[1]
            dateValues = dateValues.split(',')
            dateValues = dateValues.map(el => {return el.trim()})
            for (let dateValue of dateValues) {
                dateValue = dateValue.replace(/`/g, ':')
                if (!vallidateDate(dateValue, isTimestamp))
                    throw new Error(`Unsupported format for ${filterName}: ${filterValue}`)
            }
        }
        let operator = 'eq'
        if (filtSplit.length == 2)
            operator = filtSplit[0]
        if (!filterCombinations.includes(`${filterName}-${operator}`))
            filterCombinations.push(`${filterName}-${operator}`)
        else
            throw new Error(`Invalid query: the operator "${operator}" is used more than once for the same filter "${filterName}"`)
    }
    return true
}

const validateQuery = (requestQuery) => {
    const allowedParams = [
        'ReportDtAfter',
        'StartDateTs',
        'EndDateTs',
        'ReportDt',
        'State',
        'JobType',
        'System',
        'Table',
        'OutputFields',
        'OrderBy'
    ]
    const queryFields = Object.keys(requestQuery)
    const validate = difference(queryFields, allowedParams)
    if (validate.length > 0)
        throw new Error(`Unsupported parameters in the query: ${JSON.stringify(validate)}`)
    else if ((queryFields.includes('ReportDtAfter')) && (queryFields.includes('ReportDt')))
        throw new Error('Conflicting parameters in the query: "ReportDtAfter" and "ReportDt" cannot be used simultaneously')
    else if ((queryFields.includes('ReportDtAfter')) && (isArray(requestQuery.ReportDtAfter)))
        throw new Error('Usage of multiple ReportDtAfter in the same query is not supported')
    else {
        for (const param of Object.keys(requestQuery)) {
            if (param == 'OutputFields')
                validateOutputFields(requestQuery.OutputFields)
            else if (param == 'OrderBy')
                validateOrderBy(requestQuery.OrderBy)
            else {
                let allowedOperators = null
                let validateDate = 0
                if (['StartDateTs', 'EndDateTs', 'ReportDt'].includes(param)) {
                    validateDate = (param == 'ReportDt') ? 2 : 1
                    allowedOperators = ['eq', 'not_eq', 'lower_than', 'lower_than_or_eq_to', 'greater_than', 'greater_than_or_eq_to', 'is_in', 'not_in']
                } else if(param == 'ReportDtAfter') {
                    validateDate = 2
                    allowedOperators = null
                } else
                    allowedOperators = ['eq', 'not_eq', 'is_in', 'not_in']
                validateOther(param, requestQuery[param], allowedOperators, validateDate)
            }
        }
        return true
    }
}


module.exports = {
    validateQuery: validateQuery
}