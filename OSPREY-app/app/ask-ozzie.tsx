import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import OzzieMascot from '@/components/OzzieMascot';
import { useDailySummary } from '@/hooks/useDailySummary';

export default function AskOzzieScreen() {
  const { data } = useDailySummary();
  const [question, setQuestion] = useState('');

  function handleSend() {
    if (!question.trim()) return;
    Alert.alert(
      "Ozzie's still learning to chat",
      "Two-way conversations with Ozzie are on the way. For now, check today's read below, or use “Why this session?” on the Home tab.",
    );
    setQuestion('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ask Ozzie" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            Full two-way chat with Ozzie is coming soon. In the meantime, drop a question below and
            we'll let you know when it's live.
          </Text>
        </ScrollView>

        <View style={styles.composeRow}>
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask Ozzie something..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
