import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Coordinate = { latitude: number; longitude: number };

export default function RunMap({ region: _region, coordinates: _coordinates }: { region: Region; coordinates: Coordinate[] }) {
  return (
    <View style={styles.map}>
      <Text style={styles.placeholder}>Map preview unavailable on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: Colors.textMuted, fontSize: 13 },
});
