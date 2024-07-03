// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'sql7.freemysqlhosting.net',
    port: 3306, // Порт по умолчанию для MySQL в MAMP
    user: 'sql7717733', // Имя пользователя по умолчанию для MySQL в MAMP
    password: 'td6EDBrJ9u', // Пароль по умолчанию для MySQL в MAMP
    database: 'sql7717733' // Убедитесь, что это правильное имя базы данных
});

pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to the database.');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to the database:', err);
    });

module.exports = pool;