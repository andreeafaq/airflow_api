const difference = require('./commonFunctions').difference
const isArray = require('./commonFunctions').isArray
const settings = require('./settings.json')
const allowedFields = Object.entries(settings).filter(([k, v]) => v.output).map(([k, v]) => k)
const allFields = Object.entries(settings).map(([k, v]) => k)


const validateDate = (value, isTimestamp=true) => {
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

const VALIDATE = {
    "validateOutputFields": (requestQuery, parameter) =>{
        if (parameter != 'OutputFields')
            throw new Error('Improper usage of the "OutputFields" validator')
        let outputFields = requestQuery['OutputFields']
        if (outputFields) {
            if (isArray(outputFields))
                throw new Error('Usage of multiple OutputFields in the same query is not supported')
            outputFields = outputFields.split(',')
            outputFields = outputFields.map(el => {return el.trim()})
            const validate = difference(outputFields, allowedFields)
            if (validate.length > 0)
                throw new Error(`Unsupported output fields: ${JSON.stringify(validate)}`)
        }
        return true
    },
    "validateOrderBy": (requestQuery, parameter) => {
        if (parameter != 'OrderBy')
            throw new Error('Improper usage of the "OrderBy" validator')
        let orderBy = requestQuery['OrderBy']
        if (orderBy) {
            if (isArray(orderBy))
                throw new Error('Usage of multiple OrderBy in the same query is not supported')
            orderBy = orderBy.split(',')
            orderBy = orderBy.map(el => {return el.trim()})
            let validate = []
            for (const o of orderBy) {
                let orderElement = o.split(':')
                orderElement = orderElement.map(el => {return el.trim()})
                if ((orderElement.length == 2 ) && (orderElement[1] == ''))
                    orderElement[1] = 'ASC'
                const validateElement = allowedFields.includes(orderElement[0])
                if (!validateElement)
                    validate.push(o)
                else if (orderElement.length > 2)
                    validate.push(o)
                else if ((orderElement.length == 2 ) && (!['ASC', 'DESC'].includes(orderElement[1].toUpperCase())))
                        validate.push(o)
            }
            if (validate.length > 0)
                throw new Error(`Unsupported OrderBy fields: ${JSON.stringify(validate)}`)
        }
        return true
    },
    "validateOther": (requestQuery, parameter) => {
        let filterValues = requestQuery[parameter]
        if (!isArray(filterValues))
            filterValues = [filterValues]
        const field = settings[parameter]
        const allowedOperators = (field.operators)
                                 ? field.operators
                                 : ((field.operator) ? null: 'eq')
        const isTimestamp = (field.isTimestamp)
                            ? true
                            : (field.field && settings[field.field].isTimestamp) ? true : false
        const isDate = (field.isDate)
                       ? true
                       : (field.field && settings[field.field].isDate) ? true : false
        filterCombinations = []
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
            for (const f of filtSplit)
                if (f == '')
                    throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
            if (filtSplit.length > 2)
                throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
            if ((filtSplit.length == 2) && (allowedOperators) && (allowedOperators.length > 0) && (!allowedOperators.includes(filtSplit[0])))
                throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
            if ((filtSplit.length != 1) && (!allowedOperators))
                throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
            if ((filtSplit.length == 1) && (!allowedOperators != 'eq') && (!field.field))
                throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
            if (isDate || isTimestamp) {
                let dateValues = (filtSplit.length == 1) ? filtSplit[0] : filtSplit[1]
                dateValues = dateValues.split(',')
                dateValues = dateValues.map(el => {return el.trim()})
                for (let dateValue of dateValues) {
                    if (isTimestamp)
                        dateValue = dateValue.replace(/`/g, ':')
                    if (!validateDate(dateValue, isTimestamp))
                        throw new Error(`Unsupported format for ${parameter}: ${filterValue}`)
                }
            }
            let operator = 'eq'
            if (filtSplit.length == 2)
                operator = filtSplit[0]
            if (!filterCombinations.includes(`${parameter}-${operator}`))
                filterCombinations.push(`${parameter}-${operator}`)
            else
                throw new Error(`Invalid query: the operator "${operator}" is used more than once for the same filter "${parameter}"`)
        }
        return true
    }
}

const validateQuery = (requestQuery) => {
    requestQuery = [...Object.entries(requestQuery)].reduce((obj, [k, v]) => {
        obj[k.trim()] = (typeof(v) == 'string') ? v.trim() : v
        return obj
    }, {})
    let queryFields = Object.keys(requestQuery)
    const validate = difference(queryFields, allFields)
    if (validate.length > 0)
        throw new Error(`Unsupported parameters in the query: ${JSON.stringify(validate)}`)
    const customFields = Object.entries(settings).filter(([k, v]) => (!v.output && v.operator)).map(([k, v]) => k)
    if (customFields.length)
        for (customField of customFields) {
            const field = settings[customField].field
            if ((queryFields.includes(customField)) && (queryFields.includes(field)))
                throw new Error(`Conflicting parameters in the query: "${customField}" and "${field}" cannot be used simultaneously`)
            if ((queryFields.includes(customField)) && (isArray(requestQuery[customField])))
                throw new Error(`Usage of multiple "${customField}" in the same query is not supported`)
        }
    for (const param of queryFields) {
        const validator = settings[param].validator
        VALIDATE[validator](requestQuery, param)
    }
    return true
}


module.exports = {
    validateQuery: validateQuery
}