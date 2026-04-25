import React, { useMemo, useState, createContext, useContext } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const API_BASE = 'http://localhost:4000/api';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const authFetch = async (path, method = 'GET', body, token) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed');
  }

  return response.json();
};

function AuthScreen() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('guest@example.com');
  const [password, setPassword] = useState('Password123!');

  const handleLogin = async () => {
    try {
      const data = await authFetch('/auth/login', 'POST', { email, password });
      setSession(data);
    } catch (error) {
      Alert.alert('Login failed', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>P2P Parking Marketplace</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function GuestHome() {
  const { session } = useAuth();
  const [spots, setSpots] = useState([]);
  const [filters, setFilters] = useState({ maxPrice: '20', vehicleSize: 'Sedan', distanceKm: '5' });
  const [selectedSpot, setSelectedSpot] = useState(null);

  const search = async () => {
    try {
      const params = new URLSearchParams({
        lat: '37.7749',
        lng: '-122.4194',
        maxPrice: filters.maxPrice,
        vehicleSize: filters.vehicleSize,
        distanceKm: filters.distanceKm,
      });
      const data = await authFetch(`/spots/search?${params.toString()}`, 'GET', undefined, session.token);
      setSpots(data.results);
    } catch (error) {
      Alert.alert('Search failed', error.message);
    }
  };

  const navigateToSpot = () => {
    if (!selectedSpot) return;
    const { lat, lng } = selectedSpot;
    const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    Linking.openURL(Platform.OS === 'ios' ? google : waze).catch(() => Linking.openURL(google));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.subtitle}>Find parking near you</Text>
      <View style={styles.row}>
        <TextInput style={styles.filterInput} value={filters.maxPrice} onChangeText={(v) => setFilters({ ...filters, maxPrice: v })} placeholder="Max $/hr" keyboardType="numeric" />
        <TextInput style={styles.filterInput} value={filters.vehicleSize} onChangeText={(v) => setFilters({ ...filters, vehicleSize: v })} placeholder="Sedan or SUV" />
        <TextInput style={styles.filterInput} value={filters.distanceKm} onChangeText={(v) => setFilters({ ...filters, distanceKm: v })} placeholder="Distance km" keyboardType="numeric" />
      </View>
      <TouchableOpacity style={styles.button} onPress={search}>
        <Text style={styles.buttonText}>Search Spots</Text>
      </TouchableOpacity>

      <MapView
        style={styles.map}
        initialRegion={{ latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: Number(spot.lat), longitude: Number(spot.lng) }}
            title={`$${spot.price_per_hour}/hr`}
            description={spot.address}
            onPress={() => setSelectedSpot(spot)}
          />
        ))}
      </MapView>

      {selectedSpot ? (
        <View style={styles.card}>
          <Text>{selectedSpot.address}</Text>
          <Text>${selectedSpot.price_per_hour}/hr • {selectedSpot.vehicle_size}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={navigateToSpot}>
            <Text style={styles.buttonText}>Navigate to Spot</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function HostHome() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState({ totalEarnings: 0, upcomingBookings: [] });

  const loadDashboard = async () => {
    try {
      const data = await authFetch('/hosts/dashboard', 'GET', undefined, session.token);
      setDashboard(data);
    } catch (error) {
      Alert.alert('Dashboard failed', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.subtitle}>Host Dashboard</Text>
      <TouchableOpacity style={styles.button} onPress={loadDashboard}>
        <Text style={styles.buttonText}>Refresh</Text>
      </TouchableOpacity>
      <Text style={styles.dashboardText}>Total Earnings: ${dashboard.totalEarnings.toFixed(2)}</Text>
      <Text style={styles.dashboardText}>Upcoming Bookings: {dashboard.upcomingBookings.length}</Text>
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  const authValue = useMemo(() => ({ session, setSession }), [session]);

  return (
    <AuthContext.Provider value={authValue}>
      {!session ? <AuthScreen /> : session.user.role === 'HOST' ? <HostHome /> : <GuestHome />}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAFAFA' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 16 },
  subtitle: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, marginBottom: 10, padding: 10 },
  filterInput: { flex: 1, borderWidth: 1, borderColor: '#CCC', borderRadius: 8, marginRight: 8, padding: 8 },
  button: { backgroundColor: '#3A72F8', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  secondaryButton: { backgroundColor: '#16A34A', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: '700' },
  row: { flexDirection: 'row', marginBottom: 10 },
  map: { flex: 1, borderRadius: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginTop: 10 },
  dashboardText: { fontSize: 16, marginBottom: 8 },
});
