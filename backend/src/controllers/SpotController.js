const pool = require('../config/db');


const haversineKmSql = `
  (6371 * acos(
    cos(radians($1)) * cos(radians(ps.lat)) *
    cos(radians(ps.lng) - radians($2)) +
    sin(radians($1)) * sin(radians(ps.lat))
  ))
`;

exports.searchSpots = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const maxPrice = Number(req.query.maxPrice || 9999);
    const distanceKm = Number(req.query.distanceKm || 10);
    const vehicleSize = req.query.vehicleSize || 'Sedan';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'lat/lng are required query params' });
    }

    const { rows } = await pool.query(
      `
      SELECT
        ps.id,
        ps.host_id,
        ps.address,
        ps.lat,
        ps.lng,
        ps.price_per_hour,
        ps.vehicle_size,
        ${haversineKmSql} AS distance_km
      FROM parking_spots ps
      WHERE ps.status = 'ACTIVE'
        AND ps.price_per_hour <= $3
        AND ($4 = 'ANY' OR ps.vehicle_size = $4)
        AND ${haversineKmSql} <= $5
      ORDER BY distance_km ASC, ps.price_per_hour ASC
      LIMIT 100;
      `,
      [lat, lng, maxPrice, vehicleSize.toUpperCase(), distanceKm]
    );

    return res.json({ count: rows.length, results: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

exports.createBooking = async (req, res) => {
  const client = await pool.connect();
  try {
    const { spotId, startTime, endTime } = req.body;
    const guestId = req.user.sub;

    if (!spotId || !startTime || !endTime) {
      return res.status(400).json({ message: 'spotId, startTime, endTime required' });
    }

    await client.query('BEGIN');

    const overlapCheck = await client.query(
      `
      SELECT id
      FROM bookings
      WHERE spot_id = $1
        AND booking_status IN ('PENDING', 'CONFIRMED', 'IN_USE')
        AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
      FOR UPDATE;
      `,
      [spotId, startTime, endTime]
    );

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Time slot already booked' });
    }

    const spotResult = await client.query('SELECT price_per_hour FROM parking_spots WHERE id = $1 AND status = $2', [spotId, 'ACTIVE']);
    if (!spotResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Parking spot unavailable' });
    }

    const ms = new Date(endTime) - new Date(startTime);
    const durationHours = ms / (1000 * 60 * 60);
    if (durationHours <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    const totalPrice = Number(spotResult.rows[0].price_per_hour) * durationHours;
    const commission = totalPrice * 0.15;
    const hostPayout = totalPrice - commission;

    const bookingInsert = await client.query(
      `
      INSERT INTO bookings (spot_id, guest_id, start_time, end_time, total_price, platform_fee, host_payout, booking_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      RETURNING *;
      `,
      [spotId, guestId, startTime, endTime, totalPrice, commission, hostPayout]
    );

    await client.query('COMMIT');
    return res.status(201).json({ booking: bookingInsert.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Booking failed', error: error.message });
  } finally {
    client.release();
  }
};

exports.hostDashboard = async (req, res) => {
  try {
    const hostId = req.user.sub;
    const earnings = await pool.query(
      `
      SELECT COALESCE(SUM(b.host_payout), 0) AS total_earnings
      FROM bookings b
      JOIN parking_spots ps ON ps.id = b.spot_id
      WHERE ps.host_id = $1 AND b.booking_status IN ('COMPLETED', 'RELEASED');
      `,
      [hostId]
    );

    const upcoming = await pool.query(
      `
      SELECT b.id, b.start_time, b.end_time, b.total_price, ps.address
      FROM bookings b
      JOIN parking_spots ps ON ps.id = b.spot_id
      WHERE ps.host_id = $1 AND b.start_time > NOW() AND b.booking_status IN ('CONFIRMED', 'IN_USE')
      ORDER BY b.start_time ASC
      LIMIT 20;
      `,
      [hostId]
    );

    return res.json({
      totalEarnings: Number(earnings.rows[0].total_earnings),
      upcomingBookings: upcoming.rows,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Could not load host dashboard', error: error.message });
  }
};
