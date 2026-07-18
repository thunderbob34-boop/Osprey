import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';

interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
}

export default function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.ink,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.textMut,
    textAlign: 'center',
    lineHeight: 20,
  },
});
