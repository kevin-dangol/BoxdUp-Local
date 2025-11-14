const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const mealRoutes = require('./routes/mealPlanner');
const adminRoutes = require('./routes/admin');
const db = require('./config/db');

const app = express();

app.use(cors({
    credentials: true,
    origin: '*'
}));
app.use(express.json());
app.use(express.static('../'));

app.use('/api/auth', authRoutes);
app.use('/api/mealPlanner', mealRoutes);
app.use('/api/admin', adminRoutes);

db.getConnection()
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection failed:', err));

//Creating Tables
(async () => {
    try {
        const conn = await db.getConnection();

        //Cards
        await conn.query(`
          CREATE TABLE IF NOT EXISTS cards (
              c_id INT AUTO_INCREMENT PRIMARY KEY,
              email VARCHAR(255) NOT NULL,
              card_numb VARCHAR(20) NOT NULL,
              card_expiry VARCHAR(7) NOT NULL,
              card_cvv VARCHAR(4) NOT NULL,
              card_holder VARCHAR(255) NOT NULL
          ) ENGINE=InnoDB;
        `);
        console.log('Cards table created or already exists');

        //Subscriptions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
               s_id INT AUTO_INCREMENT PRIMARY KEY,
               email VARCHAR(255) NOT NULL,
               fname VARCHAR(100) NOT NULL,
               lname VARCHAR(100) NOT NULL,
               address VARCHAR(255) NOT NULL,
               number VARCHAR(20) NOT NULL,
               s_type VARCHAR(20) NOT NULL,
               d_time VARCHAR(20) NOT NULL,
               c_id INT DEFAULT NULL,
               FOREIGN KEY (c_id) REFERENCES cards(c_id)
            ) ENGINE=InnoDB;
        `);
        console.log('Subscriptions table created or already exists');

        //Users
        await conn.query(`
          CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              email VARCHAR(255) NOT NULL UNIQUE,
              username VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              is_admin BOOLEAN DEFAULT FALSE,
              c_id INT DEFAULT NULL,
              s_id INT DEFAULT NULL,
              FOREIGN KEY (c_id) REFERENCES cards(c_id),
              FOREIGN KEY (s_id) REFERENCES subscriptions(s_id)
          ) ENGINE=InnoDB;
        `);
        console.log('Users table created or already exists');

        //Meals
        await conn.query(`
            CREATE TABLE IF NOT EXISTS meals (
               id INT AUTO_INCREMENT PRIMARY KEY,
               user_id INT NOT NULL,
               day VARCHAR(20) NOT NULL,
               protein_name VARCHAR(100),
               protein_calories INT,
               protein_icon VARCHAR(50),
               side1_name VARCHAR(100),
               side1_calories INT,
               side1_icon VARCHAR(50),
               side2_name VARCHAR(100),
               side2_calories INT,
               side2_icon VARCHAR(50),
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
               FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
               UNIQUE KEY unique_user_day (user_id, day)
            ) ENGINE=InnoDB;
        `);
        console.log('Meals table created or already exists');

        //Meal Requests
        await conn.query(`
            CREATE TABLE IF NOT EXISTS meal_requests (
                request_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                diet_type VARCHAR(50),
                protein_level VARCHAR(50),
                allergies TEXT,
                spice_level VARCHAR(50),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255),
                phone VARCHAR(20),
                address TEXT,
                subscription_type VARCHAR(10),
                delivery_time VARCHAR(10),
                card_number VARCHAR(255),
                card_expiry VARCHAR(10),
                card_cvv VARCHAR(10),
                card_holder VARCHAR(255),
                main_dishes TEXT,
                side1_dishes TEXT,
                side2_dishes TEXT,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log('Meal Requests table created or already exists');

        //Food Items
        await conn.query(`
            CREATE TABLE IF NOT EXISTS food_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255),
                icon VARCHAR(50),
                calories INT,
                category VARCHAR(50),
                tags TEXT,
                diet_tags TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log('Food items table created or already exists');

        conn.release();

    } catch (err) {
        console.error('Failed to create table:', err);
    }
})();

app.listen(3001, () => {
    console.log('Server running on port 3001');
});
