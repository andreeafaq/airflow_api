const requestInitializer = require('./processor').requestInitializer
const hasProperty = require('./commonFunctions').hasProperty
const isEmptyObj = require('./commonFunctions').isEmptyObj

const errorHandler = (err, req, res, next) => {
    const request = requestInitializer(req)
    const errStatus = err.statusCode || 500
    const errMsg = err.message || 'Something went wrong'
    const errObj = {
        message: errMsg
    }
    if ((hasProperty(err, 'type')) && (!isEmptyObj(err.type)))
        errObj.type = err.type
    if ((hasProperty(err, 'name')) && (!isEmptyObj(err.name)))
        errObj.name = err.name
    if ((hasProperty(err, 'code')) && (!isEmptyObj(err.code)))
        errObj.code = err.code
    if ((hasProperty(err, 'errno')) && (!isEmptyObj(err.errno)))
        errObj.errno = err.errno
    if ((hasProperty(err, 'number')) && (!isEmptyObj(err.number)))
        errObj.number = err.number
    if ((hasProperty(err, 'text')) && (!isEmptyObj(err.text)))
        errObj.text = err.text
    if ((process.env.NODE_ENV === 'development') && (hasProperty(err, 'stack')) && (!isEmptyObj(err.stack)))
        errObj.stack = err.stack
    res.status(errStatus).json({
        request: request,
        success: false,
        status: errStatus,
        response: {
            error: errObj
        }
    })
}


module.exports = {
    errorHandler: errorHandler
}