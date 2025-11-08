const db = require('../config/db');

class User {
    static async create(email, username, password) {
        const query = 'INSERT INTO users (email, username, password, is_admin) VALUES (?, ?, ?, ?)';
        await db.query(query, [email, username, password, false]);
    }

    static async findByUsername(username) {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    }

    static async updateUserCardAndSubscription(email) {
        const updateCardQuery = `UPDATE users JOIN cards
                                        ON users.email = cards.email
                                        SET users.c_id = cards.c_id
                                        WHERE users.email = ?`;

        const updateSubQuery = `UPDATE users
                                       JOIN subscriptions ON users.email = subscriptions.email
                                       SET users.s_id = subscriptions.s_id
                                       WHERE users.email = ?`;

        try {
            await db.query(updateCardQuery, [email]);
            await db.query(updateSubQuery, [email]);
        } catch (error) {
            console.error('Error updating user card/subscription IDs:', error);
            throw error;
        }
    }
}

module.exports = User;