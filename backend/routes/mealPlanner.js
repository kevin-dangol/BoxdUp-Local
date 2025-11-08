const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();
const SECRET_KEY = "secret_key";

//verify token
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

//Create meals table
async function ensureMealsTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS meals (
            m_id INT AUTO_INCREMENT PRIMARY KEY,
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
        )
    `;
    try {
        await db.query(createTableQuery);
        console.log('Meals table ensured');
    } catch (error) {
        console.error('Error creating meals table:', error);
    }
}

//initialize table
ensureMealsTable();

//save meal plan
router.post('/save', verifyToken, async (req, res) => {
    const { meals } = req.body;
    const userId = req.userId;

    if (!meals) {
        return res.status(400).json({ success: false, message: 'Meals data required' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        //delete existing meals for this user
        await connection.query('DELETE FROM meals WHERE user_id = ?', [userId]);

        //insert new meals
        for (const [day, meal] of Object.entries(meals)) {
            if (meal === null) continue;

            await connection.query(`
                INSERT INTO meals (
                    user_id, day,
                    protein_name, protein_calories, protein_icon,
                    side1_name, side1_calories, side1_icon,
                    side2_name, side2_calories, side2_icon
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, day,
                meal.protein.name, meal.protein.calories, meal.protein.icon,
                meal.side1.name, meal.side1.calories, meal.side1.icon,
                meal.side2.name, meal.side2.calories, meal.side2.icon
            ]);
        }

        await connection.commit();
        res.json({ success: true, message: 'Meals saved successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error saving meals:', error);
        res.status(500).json({ success: false, message: 'Error saving meals' });
    } finally {
        connection.release();
    }
});

//get saved meals
router.get('/get', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        const [rows] = await db.query(`
            SELECT 
                day,
                protein_name, protein_calories, protein_icon,
                side1_name, side1_calories, side1_icon,
                side2_name, side2_calories, side2_icon
            FROM meals
            WHERE user_id = ?
            ORDER BY FIELD(day, 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')
        `, [userId]);

        const meals = {
            sunday: null,
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null
        };

        rows.forEach(row => {
            meals[row.day] = {
                protein: {
                    name: row.protein_name,
                    calories: row.protein_calories,
                    icon: row.protein_icon
                },
                side1: {
                    name: row.side1_name,
                    calories: row.side1_calories,
                    icon: row.side1_icon
                },
                side2: {
                    name: row.side2_name,
                    calories: row.side2_calories,
                    icon: row.side2_icon
                }
            };
        });

        res.json({ success: true, meals });

    } catch (error) {
        console.error('Error getting meals:', error);
        res.status(500).json({ success: false, message: 'Error retrieving meals' });
    }
});

//checkout
router.post('/checkout', verifyToken, async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        number,
        address,
        cardNumber,
        cardExpiry,
        cardCvv,
        cardHolder,
        subscriptionType,
        deliveryTime
    } = req.body;

    const userId = req.userId;

    //validation
    if (!firstName || !lastName || !email || !number || !address) {
        return res.status(400).json({ success: false, message: 'All personal fields are required' });
    }

    if (!cardNumber || !cardExpiry || !cardCvv || !cardHolder) {
        return res.status(400).json({ success: false, message: 'Payment information is required' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        //check if user has selected meals
        const [mealCheck] = await connection.query(
            'SELECT COUNT(*) as count FROM meals WHERE user_id = ?',
            [userId]
        );

        if (mealCheck[0].count === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Please select your meals before checkout'
            });
        }

        //insert or update card information
        const [existingCard] = await connection.query(
            'SELECT c_id FROM cards WHERE email = ?',
            [email]
        );

        let cardId;
        if (existingCard.length > 0) {
            //update existing card
            await connection.query(`
                UPDATE cards 
                SET card_numb = ?, card_expiry = ?, card_cvv = ?, card_holder = ?
                WHERE email = ?
            `, [cardNumber, cardExpiry, cardCvv, cardHolder, email]);
            cardId = existingCard[0].c_id;
        } else {
            //insert new card
            const [cardResult] = await connection.query(`
                INSERT INTO cards (email, card_numb, card_expiry, card_cvv, card_holder)
                VALUES (?, ?, ?, ?, ?)
            `, [email, cardNumber, cardExpiry, cardCvv, cardHolder]);
            cardId = cardResult.insertId;
        }

        //insert or update subscription
        const [existingSub] = await connection.query(
            'SELECT s_id FROM subscription WHERE email = ?',
            [email]
        );

        let subId;
        if (existingSub.length > 0) {
            //update existing subscription
            await connection.query(`
                UPDATE subscription 
                SET fname = ?, lname = ?, address = ?, number = ?, s_type = ?, d_time = ?, c_id = ?
                WHERE email = ?
            `, [firstName, lastName, address, number, subscriptionType, deliveryTime, cardId, email]);
            subId = existingSub[0].s_id;
        } else {
            //insert new subscription
            const [subResult] = await connection.query(`
                INSERT INTO subscription (email, fname, lname, address, number, s_type, d_time, c_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [email, firstName, lastName, address, number, subscriptionType, deliveryTime, cardId]);
            subId = subResult.insertId;
        }

        //update user with card_id and subscription_id
        await connection.query(`
            UPDATE users 
            SET c_id = ?, s_id = ? 
            WHERE id = ?
        `, [cardId, subId, userId]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Order placed successfully',
            data: {
                subscriptionId: subId,
                cardId: cardId
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error processing order:', error);
        res.status(500).json({ success: false, message: 'Error processing order: ' + error.message });
    } finally {
        connection.release();
    }
});

//get subscription details
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

//get checkout data
router.get('/checkout-data', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        //get user's saved subscription info
        const [userRows] = await db.query(`
            SELECT u.email, s.fname, s.lname, s.address, s.number, 
                   s.s_type, s.d_time, c.card_holder, c.card_numb
            FROM users u
            LEFT JOIN subscription s ON u.s_id = s.s_id
            LEFT JOIN cards c ON u.c_id = c.c_id
            WHERE u.id = ?
        `, [userId]);

        const userData = userRows.length > 0 ? userRows[0] : null;

        res.json({
            success: true,
            data: userData
        });

    } catch (error) {
        console.error('Error getting checkout data:', error);
        res.status(500).json({ success: false, message: 'Error retrieving checkout data' });
    }
});

//update subscription info
router.post('/update-subscription', verifyToken, async (req, res) => {
    const { firstName, lastName, email, number, address, deliveryTime } = req.body;
    const userId = req.userId;

    if (!firstName || !lastName || !email || !number || !address) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        //get user's subscription ID
        const [userRows] = await connection.query(
            'SELECT s_id FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0 || !userRows[0].s_id) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No subscription found' });
        }

        const subId = userRows[0].s_id;

        //update subscription
        await connection.query(`
            UPDATE subscriptions 
            SET fname = ?, lname = ?, email = ?, number = ?, address = ?, d_time = ?
            WHERE s_id = ?
        `, [firstName, lastName, email, number, address, deliveryTime, subId]);

        await connection.commit();
        res.json({ success: true, message: 'Subscription updated successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating subscription:', error);
        res.status(500).json({ success: false, message: 'Error updating subscription' });
    } finally {
        connection.release();
    }
});

//change subscription plan
router.post('/change-plan', verifyToken, async (req, res) => {
    const { subscriptionType } = req.body;
    const userId = req.userId;

    if (!subscriptionType) {
        return res.status(400).json({ success: false, message: 'Subscription type required' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        //get user's subscription ID
        const [userRows] = await connection.query(
            'SELECT s_id FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0 || !userRows[0].s_id) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No subscription found' });
        }

        const subId = userRows[0].s_id;

        //update subscription type
        await connection.query(`
            UPDATE subscriptions 
            SET s_type = ?
            WHERE s_id = ?
        `, [subscriptionType, subId]);

        await connection.commit();
        res.json({ success: true, message: 'Subscription plan changed successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error changing plan:', error);
        res.status(500).json({ success: false, message: 'Error changing plan' });
    } finally {
        connection.release();
    }
});

//pause subscription
router.post('/pause-subscription', verifyToken, async (req, res) => {
    const userId = req.userId;

    try {
        //get user's subscription ID
        const [userRows] = await db.query(
            'SELECT s_id FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0 || !userRows[0].s_id) {
            return res.status(404).json({ success: false, message: 'No subscription found' });
        }

        res.json({ success: true, message: 'Subscription paused successfully' });

    } catch (error) {
        console.error('Error pausing subscription:', error);
        res.status(500).json({ success: false, message: 'Error pausing subscription' });
    }
});

//cancel subscription
router.post('/cancel-subscription', verifyToken, async (req, res) => {
    const userId = req.userId;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        //get user's subscription and card IDs
        const [userRows] = await connection.query(
            'SELECT s_id, c_id FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { s_id, c_id } = userRows[0];

        //delete meals
        await connection.query('DELETE FROM meals WHERE user_id = ?', [userId]);

        //delete subscription if exists
        if (s_id) {
            await connection.query('DELETE FROM subscriptions WHERE s_id = ?', [s_id]);
        }

        //delete card if exists
        if (c_id) {
            await connection.query('DELETE FROM cards WHERE c_id = ?', [c_id]);
        }

        //update user to remove references
        await connection.query(`
            UPDATE users 
            SET s_id = NULL, c_id = NULL 
            WHERE id = ?
        `, [userId]);

        await connection.commit();
        res.json({ success: true, message: 'Subscription cancelled successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ success: false, message: 'Error cancelling subscription' });
    } finally {
        connection.release();
    }
});

module.exports = router;