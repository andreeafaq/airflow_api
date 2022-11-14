const isEmptyObj = (obj) => {
    if (obj == null)
        return true
    if (typeof(obj) === 'object')
        return Object.keys(obj).length === 0
    else
        return false
}

const hasProperty = (obj, property) => {
    try {
        if (Object.prototype.hasOwnProperty.call(obj, property)) {
            return true
        } else {
            return false
        }
    } catch (e) {
        if (e instanceof TypeError) {
            return false
        } else {
            throw e
        }
    }
}

const difference = (a, b) => {
    var setB = new Set(b)
    return [...new Set(a)].filter(x => !setB.has(x))
}

const intersect = (a, b) => {
    const setB = new Set(b)
    return [...new Set(a)].filter(x => setB.has(x))
}

const isArray = (obj) => {
    if (Object.prototype.toString.call(obj) === '[object Array]')
        return true
    else
        return false
}


module.exports = {
    isEmptyObj: isEmptyObj,
    hasProperty: hasProperty,
    difference: difference,
    intersect: intersect,
    isArray: isArray
}
