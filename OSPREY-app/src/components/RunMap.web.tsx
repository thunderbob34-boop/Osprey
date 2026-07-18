import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

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
  map: { flex: 1, backgroundColor: Theme.panel, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: Theme.textMut, fontSize: 13 },
});
