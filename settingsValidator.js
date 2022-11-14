const difference = require('./commonFunctions').difference
const settings = require('./settings.json')
const allFields = Object.keys(settings)
const outputFields = Object.entries(settings).filter(([k, v]) => v.output).map(([k, v]) => k)


const validate = () => {
    if (!allFields.includes('OutputFields'))
        throw new Error('The "OutputFields" declaration is missing from the settings JSON file.')
    if (!allFields.includes('OrderBy'))
        throw new Error('The "OrderBy" declaration is missing from the settings JSON file.')
    if (allFields.length != Array.from(new Set(allFields)).length) {
        const duplicates = allFields.filter((item, index) => allFields.indexOf(item) !== index)
        throw new Error(`The following fields are declared more than once in the settings JSON file: ${JSON.stringify(duplicates)}.`)
    }
    const expectedOutputFieldsKeys = ['output', 'validator']
    const outputFieldsKeys = Object.keys(settings.OutputFields)
    if (difference(expectedOutputFieldsKeys, outputFieldsKeys).length > 0)
        throw new Error(`Incomplete declaration for the "OutputFields" in the settings JSON file: ${JSON.stringify(settings.OutputFields)}.\nThe following keys are mandatory: ${JSON.stringify(expectedOutputFieldsKeys)}.`)
    const expectedOrderByKeys = ['output', 'default', 'validator']
    const orderByKeys = Object.keys(settings.OrderBy)
    if (difference(expectedOrderByKeys, orderByKeys).length > 0)
        throw new Error(`Incomplete declaration for the "OrderBy" in the settings JSON file: ${JSON.stringify(settings.OrderBy)}.\nThe following keys are mandatory: ${JSON.stringify(expectedOrderByKeys)}.`)
    let erroneousOutputFields = ''
    const expectedOutputKeys = ['output', 'definition', 'operators', 'validator']
    for (const outputField of outputFields) {
        const setting = settings[outputField]
        const settingKeys = Object.keys(setting)
        const okKeys = (difference(expectedOutputKeys, settingKeys).length == 0)
        if (!okKeys)
            erroneousOutputFields += `\n"${outputField}": ${JSON.stringify(setting)},\n`
    }
    if (erroneousOutputFields.length > 0) {
        erroneousOutputFields = erroneousOutputFields.substring(0, erroneousOutputFields.length - 2)
        throw new Error(`The following fields are declared incorrectly in the settings JSON file: \n\n${erroneousOutputFields}.\n\n\nSuch field settings are expected to have the following keys: ${JSON.stringify(expectedOutputKeys)}.`)
    }
    const customFields = difference(allFields, [...outputFields, ...['OutputFields', 'OrderBy']])
    if (customFields.length) {
        let erroneousCustomFields = ''
        const expectedCustomFieldsKeys = ['output', 'field', 'operator', 'validator']
        for (const customField of customFields) {
            const setting = settings[customField]
            const settingKeys = Object.keys(setting)
            const okKeys = (difference(expectedCustomFieldsKeys, settingKeys).length == 0)
            if (!okKeys)
                erroneousCustomFields += `\n"${customField}": ${JSON.stringify(setting)},\n`
        }
        if (erroneousCustomFields.length > 0) {
            erroneousCustomFields = erroneousCustomFields.substring(0, erroneousCustomFields.length - 2)
            throw new Error(`The following fields are declared incorrectly in the settings JSON file: \n\n${erroneousCustomFields}.\n\n\nSuch field settings are expected to have the following keys: ${JSON.stringify(expectedCustomFieldsKeys)}.`)
        }
        let originalFields = {}
        customFields.map(cf => Object.keys(originalFields).includes(settings[cf].field) ? originalFields[settings[cf].field].push(cf) : originalFields[settings[cf].field]  = [cf])
        const missingOutputFields = difference(Object.keys(originalFields), outputFields)
        if (missingOutputFields.length != 0) {
            let erroneousCustomFields = ''
            for (const missingOutputField of missingOutputFields) {
                const correspondingCustomFields = originalFields[missingOutputField]
                for (const correspondingCustomField of correspondingCustomFields) {
                    const setting = settings[correspondingCustomField]
                    erroneousCustomFields += `\n"${correspondingCustomField}": ${JSON.stringify(setting)},\n`
                    erroneousCustomFields += `Reason: The original field "${missingOutputField}" is not declared at all in the JSON file,\n\n`
                }
            }
            erroneousCustomFields = erroneousCustomFields.substring(0, erroneousCustomFields.length - 3)
            throw new Error(`The following fields are declared incorrectly in the settings JSON file: \n\n${erroneousCustomFields}.`)
        }
    }
    return true
}

module.exports = {
    settingsValidator: validate
}
