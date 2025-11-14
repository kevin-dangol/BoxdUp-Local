const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();
const SECRET_KEY = "secret_key";

// Middleware to verify token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Check complete user status (request + subscription)
router.get('/user-status', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        // Check for active subscription
        const [userRows] = await db.query(`
            SELECT u.s_id
            FROM users u
            WHERE u.id = ?
        `, [userId]);

        const hasActiveSubscription = userRows.length > 0 && userRows[0].s_id !== null;

        // Check for meal request status
        const [requestRows] = await db.query(`
            SELECT status
            FROM meal_requests
            WHERE user_id = ?
            ORDER BY created_at DESC
                LIMIT 1
        `, [userId]);

        let requestStatus = 'none';
        if (requestRows.length > 0) {
            requestStatus = requestRows[0].status;
        }

        res.json({
            success: true,
            hasActiveSubscription,
            requestStatus
        });
    } catch (error) {
        console.error('Error checking user status:', error);
        res.status(500).json({ success: false, message: 'Error checking user status' });
    }
});

// Create necessary tables
async function ensureTables() {
    const createRequestsTable = `
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
            )
    `;

    const createFoodItemsTable = `
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
            )
    `;

    try {
        await db.query(createRequestsTable);
        await db.query(createFoodItemsTable);
        console.log('Tables created successfully');

        await insertSampleFoods();
    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

async function insertSampleFoods() {
    const checkQuery = 'SELECT COUNT(*) as count FROM food_items';
    const [result] = await db.query(checkQuery);

    if (result[0].count > 0) return;

    const foods = [
        // Main Dishes
        { name: 'Teriyaki Chicken', icon: '🗿', calories: 280, category: 'main', tags: 'protein,chicken', diet_tags: 'non-veg' },
        { name: 'Grilled Shrimp', icon: '🦐', calories: 180, category: 'main', tags: 'protein,seafood', diet_tags: 'non-veg' },
        { name: 'Tofu Katsu', icon: '🧈', calories: 240, category: 'main', tags: 'protein,tofu', diet_tags: 'veg,vegan' },
        { name: 'Paneer Tikka', icon: '🧀', calories: 260, category: 'main', tags: 'protein,paneer', diet_tags: 'veg' },
        { name: 'Chickpea Curry', icon: '🫘', calories: 220, category: 'main', tags: 'protein,legumes', diet_tags: 'veg,vegan' },
        { name: 'Grilled Chicken Breast', icon: '🗿', calories: 250, category: 'main', tags: 'protein,chicken,high-protein', diet_tags: 'non-veg' },
        { name: 'Chicken Momo', icon: '🥟', calories: 190, category: 'main', tags: 'protein,chicken,steamed', diet_tags: 'non-veg' },
        { name: 'Veg Momo', icon: '🥬', calories: 160, category: 'main', tags: 'vegetables,steamed', diet_tags: 'veg,vegan' },
        { name: 'Dal Bhat', icon: '🛕', calories: 400, category: 'main', tags: 'carbs,protein,lentils', diet_tags: 'veg,vegan' },
        { name: 'Chicken Curry', icon: '🗿', calories: 330, category: 'main', tags: 'protein,chicken,spicy', diet_tags: 'non-veg' },
        { name: 'Pork Tonkatsu', icon: '🐷', calories: 370, category: 'main', tags: 'protein,pork,fried', diet_tags: 'non-veg' },
        { name: 'Vegetable Stir-fry', icon: '🥦', calories: 200, category: 'main', tags: 'vegetables,stir-fry', diet_tags: 'veg,vegan' },
        { name: 'Paneer Butter Masala', icon: '🧀', calories: 310, category: 'main', tags: 'protein,paneer,creamy', diet_tags: 'veg' },
        { name: 'Fish Curry', icon: '🐟', calories: 300, category: 'main', tags: 'protein,fish,spicy', diet_tags: 'non-veg' },

        // Side Dishes 1
        { name: 'Edamame', icon: '🫘', calories: 120, category: 'side1', tags: 'protein,soy', diet_tags: 'veg,vegan' },
        { name: 'Spring Rolls', icon: '🥟', calories: 180, category: 'side1', tags: 'vegetables', diet_tags: 'veg' },
        { name: 'Seaweed Salad', icon: '🥬', calories: 90, category: 'side1', tags: 'vegetables,low-cal', diet_tags: 'veg,vegan' },
        { name: 'Gyoza', icon: '🥟', calories: 200, category: 'side1', tags: 'protein', diet_tags: 'non-veg' },
        { name: 'Garden Salad', icon: '🥗', calories: 80, category: 'side1', tags: 'vegetables,low-cal', diet_tags: 'veg,vegan' },
        { name: 'Corn Salad', icon: '🌽', calories: 110, category: 'side1', tags: 'vegetables', diet_tags: 'veg,vegan' },
        { name: 'Mixed Vegetables', icon: '🥦', calories: 100, category: 'side1', tags: 'vegetables', diet_tags: 'veg,vegan' },
        { name: 'Cucumber Kimchi', icon: '🥒', calories: 60, category: 'side1', tags: 'vegetables,spicy', diet_tags: 'veg,vegan' },
        { name: 'Vegetable Tempura', icon: '🤿', calories: 230, category: 'side1', tags: 'vegetables,fried', diet_tags: 'veg' },
        { name: 'Aloo Fry', icon: '🥔', calories: 210, category: 'side1', tags: 'potato,fried,spicy', diet_tags: 'veg,vegan' },
        { name: 'Pickled Radish', icon: '🥕', calories: 50, category: 'side1', tags: 'vegetables,low-cal,pickled', diet_tags: 'veg,vegan' },
        { name: 'Steamed Dumplings', icon: '🥟', calories: 180, category: 'side1', tags: 'flour,steamed', diet_tags: 'veg' },

        // Side Dishes 2
        { name: 'Steamed Rice', icon: '🍚', calories: 150, category: 'side2', tags: 'carbs', diet_tags: 'veg,vegan' },
        { name: 'Fried Rice', icon: '🛕', calories: 220, category: 'side2', tags: 'carbs', diet_tags: 'veg' },
        { name: 'Miso Soup', icon: '🍵', calories: 60, category: 'side2', tags: 'soup,low-cal', diet_tags: 'veg,vegan' },
        { name: 'Pickled Veggies', icon: '🥒', calories: 40, category: 'side2', tags: 'vegetables,low-cal', diet_tags: 'veg,vegan' },
        { name: 'Quinoa Bowl', icon: '🥗', calories: 180, category: 'side2', tags: 'carbs,protein', diet_tags: 'veg,vegan' },
        { name: 'Sweet Potato', icon: '🍠', calories: 140, category: 'side2', tags: 'carbs', diet_tags: 'veg,vegan' },
        { name: 'Brown Rice', icon: '🍚', calories: 160, category: 'side2', tags: 'carbs', diet_tags: 'veg,vegan' },
        { name: 'Noodles', icon: '🍜', calories: 200, category: 'side2', tags: 'carbs', diet_tags: 'veg' },
        { name: 'Kimchi Fried Rice', icon: '🍚', calories: 260, category: 'side2', tags: 'carbs,spicy', diet_tags: 'veg' },
        { name: 'Garlic Noodles', icon: '🍜', calories: 230, category: 'side2', tags: 'carbs,garlic', diet_tags: 'veg' },
        { name: 'Egg Fried Rice', icon: '🍳', calories: 240, category: 'side2', tags: 'carbs,protein', diet_tags: 'non-veg' },
        { name: 'Vegetable Soup', icon: '🥣', calories: 90, category: 'side2', tags: 'soup,low-cal', diet_tags: 'veg,vegan' }
    ];


    for (const food of foods) {
        await db.query(
            'INSERT INTO food_items (name, icon, calories, category, tags, diet_tags) VALUES (?, ?, ?, ?, ?, ?)',
            [food.name, food.icon, food.calories, food.category, food.tags, food.diet_tags]
        );
    }
}

ensureTables();

// Get food options based on preferences
router.post('/food-options', verifyToken, async (req, res) => {
    const { preferences } = req.body;

    try {
        let dietFilter = '';
        if (preferences.dietType === 'veg') {
            dietFilter = "AND (diet_tags LIKE '%veg%' OR diet_tags LIKE '%vegan%')";
        } else if (preferences.dietType === 'vegan') {
            dietFilter = "AND diet_tags LIKE '%vegan%'";
        } else if (preferences.dietType === 'non-veg') {
            dietFilter = "AND diet_tags LIKE '%non-veg%'";
        }

        let proteinFilter = '';
        if (preferences.proteinLevel === 'high') {
            proteinFilter = "AND tags LIKE '%high-protein%'";
        }

        const [mainDishes] = await db.query(`
            SELECT * FROM food_items
            WHERE category = 'main' AND is_active = TRUE ${dietFilter} ${proteinFilter}
        `);

        const [side1Dishes] = await db.query(`
            SELECT * FROM food_items
            WHERE category = 'side1' AND is_active = TRUE ${dietFilter}
        `);

        const [side2Dishes] = await db.query(`
            SELECT * FROM food_items
            WHERE category = 'side2' AND is_active = TRUE ${dietFilter}
        `);

        const formatDishes = (dishes) => dishes.map(d => ({
            id: d.id,
            name: d.name,
            icon: d.icon,
            calories: d.calories,
            tags: d.tags.split(',')
        }));

        res.json({
            success: true,
            foods: {
                mainDishes: formatDishes(mainDishes),
                side1Dishes: formatDishes(side1Dishes),
                side2Dishes: formatDishes(side2Dishes)
            }
        });
    } catch (error) {
        console.error('Error getting food options:', error);
        res.status(500).json({ success: false, message: 'Error retrieving food options' });
    }
});

// Submit meal request
router.post('/submit-request', verifyToken, async (req, res) => {
    const { preferences, userInfo, selectedFoods } = req.body;
    const userId = req.userId;

    try {
        // Check if user already has a pending or approved request
        const [existing] = await db.query(
            "SELECT * FROM meal_requests WHERE user_id = ? AND status IN ('pending', 'approved')",
            [userId]
        );

        if (existing.length > 0) {
            return res.json({
                success: false,
                message: 'You already have a pending or approved request'
            });
        }

        await db.query(`
            INSERT INTO meal_requests (
                user_id, diet_type, protein_level, allergies, spice_level,
                first_name, last_name, email, phone, address,
                subscription_type, delivery_time,
                card_number, card_expiry, card_cvv, card_holder,
                main_dishes, side1_dishes, side2_dishes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            userId,
            preferences.dietType,
            preferences.proteinLevel,
            JSON.stringify(preferences.allergies),
            preferences.spiceLevel,
            userInfo.firstName,
            userInfo.lastName,
            userInfo.email,
            userInfo.number,
            userInfo.address,
            userInfo.subscriptionType,
            userInfo.deliveryTime,
            userInfo.cardNumber,
            userInfo.cardExpiry,
            userInfo.cardCvv,
            userInfo.cardHolder,
            JSON.stringify(selectedFoods.mainDishes),
            JSON.stringify(selectedFoods.side1Dishes),
            JSON.stringify(selectedFoods.side2Dishes)
        ]);

        res.json({ success: true, message: 'Request submitted successfully' });
    } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({ success: false, message: 'Error submitting request' });
    }
});

// Check request status
router.get('/request-status', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        const [rows] = await db.query(`
            SELECT request_id, status, created_at, updated_at
            FROM meal_requests
            WHERE user_id = ?
            ORDER BY created_at DESC
                LIMIT 1
        `, [userId]);

        if (rows.length === 0) {
            return res.json({ success: true, request: null });
        }

        res.json({ success: true, request: rows[0] });
    } catch (error) {
        console.error('Error checking request status:', error);
        res.status(500).json({ success: false, message: 'Error checking status' });
    }
});

// Get approved meals for user (from existing meals table)
router.get('/approved-meals', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        const [rows] = await db.query(`
            SELECT day, protein_name, protein_icon, protein_calories,
                side1_name, side1_icon, side1_calories,
                side2_name, side2_icon, side2_calories
            FROM meals
            WHERE user_id = ?
            ORDER BY FIELD(day, 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')
        `, [userId]);

        const meals = {};
        rows.forEach(row => {
            meals[row.day] = {
                main: {
                    name: row.protein_name,
                    icon: row.protein_icon,
                    calories: row.protein_calories
                },
                side1: {
                    name: row.side1_name,
                    icon: row.side1_icon,
                    calories: row.side1_calories
                },
                side2: {
                    name: row.side2_name,
                    icon: row.side2_icon,
                    calories: row.side2_calories
                }
            };
        });

        res.json({ success: true, meals });
    } catch (error) {
        console.error('Error getting approved meals:', error);
        res.status(500).json({ success: false, message: 'Error retrieving meals' });
    }
});

// Get request info for checkout display
router.get('/request-info', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        const [rows] = await db.query(`
            SELECT first_name, last_name, email, phone, address, 
                   subscription_type, delivery_time
            FROM meal_requests
            WHERE user_id = ? AND status = 'approved'
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId]);

        if (rows.length === 0) {
            return res.json({ success: false, message: 'No approved request found' });
        }

        res.json({ success: true, request: rows[0] });
    } catch (error) {
        console.error('Error getting request info:', error);
        res.status(500).json({ success: false, message: 'Error retrieving request info' });
    }
});

// Finalize order (after approval)
router.post('/finalize-order', verifyToken, async (req, res) => {
    const userId = req.userId;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Get user's approved request
        const [requestRows] = await connection.query(
            'SELECT * FROM meal_requests WHERE user_id = ? AND status = "approved" ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (requestRows.length === 0) {
            await connection.rollback();
            return res.json({ success: false, message: 'No approved request found' });
        }

        const request = requestRows[0];

        // Insert or update card
        const [existingCard] = await connection.query('SELECT c_id FROM cards WHERE email = ?', [request.email]);

        let cardId;
        if (existingCard.length > 0) {
            await connection.query(`
                UPDATE cards
                SET card_numb = ?, card_expiry = ?, card_cvv = ?, card_holder = ?
                WHERE email = ?
            `, [request.card_number, request.card_expiry, request.card_cvv, request.card_holder, request.email]);
            cardId = existingCard[0].c_id;
        } else {
            const [cardResult] = await connection.query(`
                INSERT INTO cards (email, card_numb, card_expiry, card_cvv, card_holder)
                VALUES (?, ?, ?, ?, ?)
            `, [request.email, request.card_number, request.card_expiry, request.card_cvv, request.card_holder]);
            cardId = cardResult.insertId;
        }

        // Insert or update subscription
        const [existingSub] = await connection.query('SELECT s_id FROM subscriptions WHERE email = ?', [request.email]);

        let subId;
        if (existingSub.length > 0) {
            await connection.query(`
                UPDATE subscriptions
                SET fname = ?, lname = ?, address = ?, number = ?, s_type = ?, d_time = ?, c_id = ?
                WHERE email = ?
            `, [request.first_name, request.last_name, request.address, request.phone,
                request.subscription_type, request.delivery_time, cardId, request.email]);
            subId = existingSub[0].s_id;
        } else {
            const [subResult] = await connection.query(`
                INSERT INTO subscriptions (email, fname, lname, address, number, s_type, d_time, c_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [request.email, request.first_name, request.last_name, request.address, request.phone,
                request.subscription_type, request.delivery_time, cardId]);
            subId = subResult.insertId;
        }

        // Update user
        await connection.query('UPDATE users SET s_id = ?, c_id = ? WHERE id = ?', [subId, cardId, userId]);

        await connection.commit();
        res.json({ success: true, message: 'Order finalized successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error finalizing order:', error);
        res.status(500).json({ success: false, message: 'Error finalizing order' });
    } finally {
        connection.release();
    }
});

// Get subscription details
router.get('/subscription', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        const [rows] = await db.query(`
            SELECT s.*, c.card_numb, c.card_holder
            FROM users u
                     LEFT JOIN subscriptions s ON u.s_id = s.s_id
                     LEFT JOIN cards c ON u.c_id = c.c_id
            WHERE u.id = ?
        `, [userId]);

        if (rows.length === 0 || !rows[0].s_id) {
            return res.json({ success: false, message: 'No subscription found' });
        }

        res.json({ success: true, subscription: rows[0] });
    } catch (error) {
        console.error('Error getting subscription:', error);
        res.status(500).json({ success: false, message: 'Error retrieving subscription' });
    }
});

module.exports = router;