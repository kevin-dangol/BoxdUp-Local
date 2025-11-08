// backend/config/db.js
const mysql = require('mysql2/promise');

//local database
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'boxdup',
    port: '3306',
});


//railway database
// const pool = mysql.createPool({
//     host: 'tramway.proxy.rlwy.net',
//     user: 'root',
//     password: 'wSgaWMSDFGKLOraJDyBWSmeapjRlOCvA',
//     database: 'railway',
//     port: '22039',
//     ssl: {
//         rejectUnauthorized: false
//     },
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

(async () => {
    try {

        const connection = await pool.getConnection();
        console.log('Connected to Database');
        connection.release();

    } catch (err) {
        console.error('Database connection failed:', err);
    }
})();

module.exports = pool;
