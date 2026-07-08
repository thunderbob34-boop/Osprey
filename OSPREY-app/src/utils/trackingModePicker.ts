import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * "Outside" (GPS) vs "Stationary" (no GPS) — offered wherever a workout
 * type can be tracked either way (Run, Bike, Hiking).
 */
export function pickTrackingMode(onPick: (mode: 'outside' | 'stationary') => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Outside or stationary?',
        options: ['Outside (GPS)', 'Stationary (no GPS)', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) onPick('outside');
        else if (index === 1) onPick('stationary');
      },
    );
  } else {
    Alert.alert('Outside or stationary?', undefined, [
      { text: 'Outside (GPS)', onPress: () => onPick('outside') },
      { text: 'Stationary (no GPS)', onPress: () => onPick('stationary') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}
