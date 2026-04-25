-- Peer-to-Peer Parking Marketplace PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('HOST', 'GUEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_size AS ENUM ('SEDAN', 'SUV');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'IN_USE', 'COMPLETED', 'RELEASED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  role user_role NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  vehicle_license_plate VARCHAR(20),
  stripe_customer_id VARCHAR(255),
  stripe_connect_account_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_plate_required CHECK (
    (role = 'GUEST' AND vehicle_license_plate IS NOT NULL) OR role = 'HOST'
  )
);

CREATE TABLE IF NOT EXISTS parking_spots (
  id BIGSERIAL PRIMARY KEY,
  host_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  photo_url TEXT,
  vehicle_size vehicle_size NOT NULL DEFAULT 'SEDAN',
  price_per_hour NUMERIC(10,2) NOT NULL CHECK (price_per_hour > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spot_availability (
  id BIGSERIAL PRIMARY KEY,
  spot_id BIGINT NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  spot_id BIGINT NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  guest_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  host_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_payment_intent_id VARCHAR(255),
  booking_status booking_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_spots_geo ON parking_spots(lat, lng);
CREATE INDEX IF NOT EXISTS idx_spots_host ON parking_spots(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_spot_time ON bookings(spot_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
