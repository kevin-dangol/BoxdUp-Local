const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const meanRoutes = require('./routes/mealPlanner');
const db = require('./config/db');

const app = express();

app.use(cors({
    credentials: true,
    origin: '*'
}));
app.use(express.json());
app.use(express.static('../'));

app.use('/api/auth', authRoutes);
app.use('/api/mealPlanner', meanRoutes);

db.getConnection()
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection failed:', err));

app.listen(3001, () => {
    console.log('Server running on port 3001');
});