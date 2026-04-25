# Peer-to-Peer Parking Marketplace

Full-stack starter architecture for a cross-platform mobile app where:
- **Hosts** list private parking spots (driveways/garages).
- **Guests** discover nearby spots, book in real-time, and pay via Stripe Connect.

## Tech Stack
- **Frontend:** React Native
- **Backend:** Node.js + Express
- **Database:** PostgreSQL

## Modular Folder Structure

```text
frontend/
  App.js
  src/
    components/
    context/
    navigation/
    screens/
    services/

backend/
  src/
    config/
      db.js
    controllers/
      SpotController.js
    middleware/
      auth.js
    routes/
      index.js
    services/
      stripeService.js
    index.js

database/
  schema.sql
```

## Key Features Included
- JWT auth with role-based access (HOST/GUEST).
- Guest map discovery with `react-native-maps` and dynamic filtering.
- Booking overlap protection via server-side validation and SQL range checks.
- Host dashboard endpoint for earnings and upcoming bookings.
- Stripe Connect service scaffolding for hold-and-release payouts.
- SQL schema for users, parking spots, availability windows, and bookings.

## Run (example)

```bash
# backend
cd backend
npm install
JWT_SECRET=replace_me DATABASE_URL=postgres://... STRIPE_SECRET_KEY=sk_test_... node src/index.js
```

Then run React Native app from `frontend/` with your preferred RN workflow (Expo or CLI), and point `API_BASE` in `frontend/App.js` to your API host.
