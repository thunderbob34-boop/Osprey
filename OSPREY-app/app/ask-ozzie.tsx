import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import ScreenHeader from '@/components/ScreenHeader';
import OzzieMascot from '@/components/OzzieMascot';
import { useDailySummary } from '@/hooks/useDailySummary';

export default function AskOzzieScreen() {
  const { data } = useDailySummary();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ask Ozzie" />

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
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 },
  mascotWrap: { alignItems: 'center', marginBottom: 4 },
  heading: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
  },
  noteCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
  },
  noteText: {
    fontSize: 14,
    color: Theme.text,
    lineHeight: 20,
  },
  reasoningText: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 19,
  },
  comingSoon: {
    fontSize: 12,
    color: Theme.textMut,
    lineHeight: 18,
    textAlign: 'center',
  },
});
