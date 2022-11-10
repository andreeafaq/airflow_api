require('express-async-errors')
const express = require('express')
const app = express()
const config = require('./connector').config
const executeQuery = require('./connector').executeQuery
const errorHandler = require('./errorHandler').errorHandler
const sqlBuilder = require('./processor').sqlBuilder
const responseBuilder = require('./processor').responseBuilder
const validateQuery = require('./validator').validateQuery
console.log(`/${config.API_ENDPOINT}`)


app.get(`/${config.API_ENDPOINT}`, async (req, res) => {
    validateQuery(req.query)
    const q = sqlBuilder(req)
    const sqlResult = await executeQuery(q)
    res.status(200).json(responseBuilder(req, sqlResult))
});

app.use(errorHandler)
app.listen(config.API_PORT, () => console.log(`Listening on port ${config.API_PORT}`))