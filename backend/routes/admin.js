const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();
const SECRET_KEY = "secret_key";

// Middleware to verify token and check admin status
const verifyAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id;

        // Check if user is admin
        const [userRows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [decoded.id]);

        if (userRows.length === 0 || !userRows[0].is_admin) {
            return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
        }

        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Get all food items
router.get('/food-items', verifyAdmin, async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM food_items WHERE is_active = TRUE');

        const organized = {
            main: {},
            side1: {},
            side2: {}
        };

        items.forEach(item => {
            organized[item.category][item.id] = item;
        });

        res.json({ success: true, items: organized });
    } catch (error) {
        console.error('Error getting food items:', error);
        res.status(500).json({ success: false, message: 'Error retrieving food items' });
    }
});

// Get pending requests
router.get('/pending-requests', verifyAdmin, async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT * FROM meal_requests
            WHERE status = 'pending'
            ORDER BY created_at DESC
        `);

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Error getting pending requests:', error);
        res.status(500).json({ success: false, message: 'Error retrieving requests' });
    }
});

// Approve request and assign meals to existing meals table
router.post('/approve-request', verifyAdmin, async (req, res) => {
    const { requestId, userId, assignments } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Update request status
        await connection.query(
            'UPDATE meal_requests SET status = "approved", updated_at = NOW() WHERE request_id = ?',
            [requestId]
        );

        // Delete existing meals for this user
        await connection.query('DELETE FROM meals WHERE user_id = ?', [userId]);

        // Insert meals into existing meals table
        for (const assignment of assignments) {
            // Get food item details
            const [mainItem] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.mainId]);
            const [side1Item] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.side1Id]);
            const [side2Item] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.side2Id]);

            if (mainItem.length && side1Item.length && side2Item.length) {
                await connection.query(`
                    INSERT INTO meals (
                        user_id, day,
                        protein_name, protein_calories, protein_icon,
                        side1_name, side1_calories, side1_icon,
                        side2_name, side2_calories, side2_icon
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    assignment.day,
                    mainItem[0].name,
                    mainItem[0].calories,
                    mainItem[0].icon,
                    side1Item[0].name,
                    side1Item[0].calories,
                    side1Item[0].icon,
                    side2Item[0].name,
                    side2Item[0].calories,
                    side2Item[0].icon
                ]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Request approved successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error approving request:', error);
        res.status(500).json({ success: false, message: 'Error approving request' });
    } finally {
        connection.release();
    }
});

// Reject request
router.post('/reject-request', verifyAdmin, async (req, res) => {
    const { requestId } = req.body;

    try {
        await db.query(
            'UPDATE meal_requests SET status = "rejected", updated_at = NOW() WHERE request_id = ?',
            [requestId]
        );

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ success: false, message: 'Error rejecting request' });
    }
});

// Get all requests (for admin dashboard)
router.get('/all-requests', verifyAdmin, async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT mr.*, u.username, u.email as user_email
            FROM meal_requests mr
                     JOIN users u ON mr.user_id = u.id
            ORDER BY mr.created_at DESC
                LIMIT 100
        `);

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Error getting all requests:', error);
        res.status(500).json({ success: false, message: 'Error retrieving requests' });
    }
});

// Get statistics
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const [pendingCount] = await db.query(
            'SELECT COUNT(*) as count FROM meal_requests WHERE status = "pending"'
        );

        const [approvedCount] = await db.query(
            'SELECT COUNT(*) as count FROM meal_requests WHERE status = "approved"'
        );

        const [rejectedCount] = await db.query(
            'SELECT COUNT(*) as count FROM meal_requests WHERE status = "rejected"'
        );

        const [activeUsers] = await db.query(
            'SELECT COUNT(DISTINCT user_id) as count FROM meal_requests WHERE status = "approved"'
        );

        res.json({
            success: true,
            stats: {
                pending: pendingCount[0].count,
                approved: approvedCount[0].count,
                rejected: rejectedCount[0].count,
                activeUsers: activeUsers[0].count
            }
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ success: false, message: 'Error retrieving statistics' });
    }
});

// Add new food item
router.post('/add-food', verifyAdmin, async (req, res) => {
    const { name, icon, calories, category, tags, dietTags } = req.body;

    try {
        await db.query(`
            INSERT INTO food_items (name, icon, calories, category, tags, diet_tags)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, icon, calories, category, tags, dietTags]);

        res.json({ success: true, message: 'Food item added successfully' });
    } catch (error) {
        console.error('Error adding food item:', error);
        res.status(500).json({ success: false, message: 'Error adding food item' });
    }
});

// Update food item
router.post('/update-food', verifyAdmin, async (req, res) => {
    const { id, name, icon, calories, category, tags, dietTags, isActive } = req.body;

    try {
        await db.query(`
            UPDATE food_items
            SET name = ?, icon = ?, calories = ?, category = ?, tags = ?, diet_tags = ?, is_active = ?
            WHERE id = ?
        `, [name, icon, calories, category, tags, dietTags, isActive, id]);

        res.json({ success: true, message: 'Food item updated successfully' });
    } catch (error) {
        console.error('Error updating food item:', error);
        res.status(500).json({ success: false, message: 'Error updating food item' });
    }
});

// Delete food item (soft delete)
router.post('/delete-food', verifyAdmin, async (req, res) => {
    const { id } = req.body;

    try {
        await db.query('UPDATE food_items SET is_active = FALSE WHERE id = ?', [id]);

        res.json({ success: true, message: 'Food item deleted successfully' });
    } catch (error) {
        console.error('Error deleting food item:', error);
        res.status(500).json({ success: false, message: 'Error deleting food item' });
    }
});

// Get user's meal assignments (for admin to view)
router.get('/user-meals/:userId', verifyAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const [meals] = await db.query(`
            SELECT * FROM meals 
            WHERE user_id = ?
            ORDER BY FIELD(day, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')
        `, [userId]);

        res.json({ success: true, meals });
    } catch (error) {
        console.error('Error getting user meals:', error);
        res.status(500).json({ success: false, message: 'Error retrieving meals' });
    }
});

// Update user's meals (admin can modify existing assignments)
router.post('/update-user-meals', verifyAdmin, async (req, res) => {
    const { userId, assignments } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Delete existing meals
        await connection.query('DELETE FROM meals WHERE user_id = ?', [userId]);

        // Insert new assignments
        for (const assignment of assignments) {
            const [mainItem] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.mainId]);
            const [side1Item] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.side1Id]);
            const [side2Item] = await connection.query('SELECT * FROM food_items WHERE id = ?', [assignment.side2Id]);

            if (mainItem.length && side1Item.length && side2Item.length) {
                await connection.query(`
                    INSERT INTO meals (
                        user_id, day,
                        protein_name, protein_calories, protein_icon,
                        side1_name, side1_calories, side1_icon,
                        side2_name, side2_calories, side2_icon
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    assignment.day,
                    mainItem[0].name,
                    mainItem[0].calories,
                    mainItem[0].icon,
                    side1Item[0].name,
                    side1Item[0].calories,
                    side1Item[0].icon,
                    side2Item[0].name,
                    side2Item[0].calories,
                    side2Item[0].icon
                ]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Meals updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating meals:', error);
        res.status(500).json({ success: false, message: 'Error updating meals' });
    } finally {
        connection.release();
    }
});

module.exports = router;