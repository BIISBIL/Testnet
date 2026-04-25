const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const SpotController = require('../controllers/SpotController');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const { email } = req.body;

  // Demo-only login. Replace with bcrypt password verification in production.
  const role = email?.includes('host') ? 'HOST' : 'GUEST';
  const user = {
    id: role === 'HOST' ? 101 : 202,
    role,
    email,
    name: role === 'HOST' ? 'Demo Host' : 'Demo Guest',
  };

  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h' });

  res.json({ token, user });
});

router.get('/spots/search', requireAuth(['GUEST']), SpotController.searchSpots);
router.post('/bookings', requireAuth(['GUEST']), SpotController.createBooking);
router.get('/hosts/dashboard', requireAuth(['HOST']), SpotController.hostDashboard);

module.exports = router;
