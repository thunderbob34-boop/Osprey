import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import OzzieMascot from '@/components/OzzieMascot';
import { useDailySummary } from '@/hooks/useDailySummary';

export default function AskOzzieScreen() {
  const { data } = useDailySummary();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ozzie's Take" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mascotWrap}>
          <OzzieMascot size={96} animated />
        </View>

        <Text style={styles.heading}>Today's read</Text>
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            {data?.session?.ozzieNote ?? "Ozzie is still crunching today's read."}
          </Text>
          {data?.session?.whyReasoning ? (
            <Text style={styles.reasoningText}>{data.session.whyReasoning}</Text>
          ) : null}
        </View>

        <Text style={styles.comingSoon}>
          Two-way conversations with Ozzie aren't live yet. In the meantime, tap "Why this
          session?" on the Home tab for reasoning behind any specific workout.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 },
  mascotWrap: { alignItems: 'center', marginBottom: 4 },
  heading: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  noteCard: {
    backgroundColor: 'rgba(0,200,200,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,200,200,0.35)',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  noteText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  reasoningText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  comingSoon: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
});
