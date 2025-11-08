const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const User = require('../models/user');
const router = express.Router();
const SECRET_KEY = "secret_key";

//verify user
const verifyUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id; // <- this is what your /user route expects
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

//verify admin
const verifyAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await User.findById(decoded.id);
        if (!user || !user.is_admin) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

//signup
router.post('/signup', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        console.log('Signup request:', { email, username });
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create(email, username, hashedPassword);
        await User.updateUserCardAndSubscription(email);
        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

//login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login request:', { username });
        const user = await User.findByUsername(username);

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        await User.updateUserCardAndSubscription(user.email);

        const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ success: true, message: 'Login successful', token, is_admin: user.is_admin });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

//logout
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logout successful' });
});

//check
router.get('/check-session', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.json({ logged_in: false, is_admin: false });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ logged_in: true, is_admin: decoded.is_admin });
    } catch (error) {
        res.json({ logged_in: false, is_admin: false });
    }
});

//user
router.get('/user', verifyUser, async (req, res) => {
    const userId = req.userId;
    try {
        const [users] = await db.query(`
            SELECT id, email, username, is_admin
            FROM users
            WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ success: false, message: 'Error retrieving user info' });
    }
});


module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
module.exports.verifyUser = verifyUser;