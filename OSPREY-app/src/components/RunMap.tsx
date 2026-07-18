import MapView, { Polyline } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Coordinate = { latitude: number; longitude: number };

export default function RunMap({ region, coordinates }: { region: Region; coordinates: Coordinate[] }) {
  return (
    <MapView style={styles.map} region={region} showsUserLocation>
      {coordinates.length > 1 ? (
        <Polyline coordinates={coordinates} strokeColor={Theme.accent} strokeWidth={4} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
