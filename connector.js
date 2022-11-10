require('dotenv/config')
const mariadb = require('mariadb')
const config = process.env

const connectionSettings = {
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE
}

const executeQuery = async (q) => {
    let connection
    try {
        connection = await mariadb.createConnection(connectionSettings)
    } catch(connectionError) {
        throw connectionError
    }
    try {
        const result =  await connection.query(q)
        connection.end()
        return result
    } catch(queryError) {
        if (connection)
            connection.end()
        throw queryError
    }
}


module.exports = {
    config: config,
    executeQuery: executeQuery
}