import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui';
import ScreenHeader from '@/components/ScreenHeader';

interface Question {
  prompt: string;
  options: string[];
  correctIndex: number;
  feedback: string;
}

// Original questions, using OSPREY's own verified station data (types/hyrox.ts
// HYROX_STATIONS + hyrox.com's official rules, confirmed live 2026-07-20) —
// not hyroxlab.com's numbers, which this project independently found to be
// wrong on the Pro sled weights.
const QUESTIONS: Question[] = [
  {
    prompt: 'How many kilometers of running make up a HYROX race?',
    options: ['5km', '8km', '10km', '12km'],
    correctIndex: 1,
    feedback: 'Eight 1km runs, one before each of the 8 stations — 8km of running total.',
  },
  {
    prompt: 'Which station comes first in every HYROX race?',
    options: ['Sled Push', 'Wall Balls', 'SkiErg', 'Rowing'],
    correctIndex: 2,
    feedback: '1000m on the SkiErg opens the race, right after the first 1km run.',
  },
  {
    prompt: 'Which station always comes last?',
    options: ['Sandbag Lunges', 'Wall Balls', 'Farmers Carry', 'Sled Pull'],
    correctIndex: 1,
    feedback: '100 Wall Balls close out the race — the last thing between you and the finish line.',
  },
  {
    prompt: 'What distance is the Sled Push?',
    options: ['25m', '50m', '80m', '100m'],
    correctIndex: 1,
    feedback: 'The Sled Push covers 50m — pushing a loaded sled the full distance.',
  },
  {
    prompt: 'How far is the Burpee Broad Jump station?',
    options: ['50m', '80m', '100m', '200m'],
    correctIndex: 1,
    feedback: '80m of burpee broad jumps — a burpee, then a jump, repeated to the line.',
  },
  {
    prompt: 'What distance is the Farmers Carry?',
    options: ['100m', '150m', '200m', '250m'],
    correctIndex: 2,
    feedback: '200m carrying a weight in each hand — grip and core under load.',
  },
  {
    prompt: 'How far is the Sandbag Lunges station?',
    options: ['50m', '80m', '100m', '150m'],
    correctIndex: 2,
    feedback: '100m of walking lunges with a loaded sandbag on your back.',
  },
  {
    prompt: 'How many reps make up the Wall Balls station?',
    options: ['50 reps', '75 reps', '100 reps', '150 reps'],
    correctIndex: 2,
    feedback: '100 reps, every division — the weight changes by division, the rep count does not.',
  },
  {
    prompt: 'What distance is the Rowing station?',
    options: ['500m', '1000m', '1500m', '2000m'],
    correctIndex: 1,
    feedback: '1000m on the rower — the same distance as the opening SkiErg.',
  },
  {
    prompt: 'In the Doubles division, how is the running split between partners?',
    options: [
      "It isn't — both partners run all 8 x 1km",
      'Each partner runs 4km',
      'One partner runs, the other does stations',
      'Partners alternate every 500m',
    ],
    correctIndex: 0,
    feedback: "The most-misunderstood Doubles rule: running is never split. Both of you run all 8 x 1km — only the station reps are shared.",
  },
];

function scoreMessage(score: number): string {
  if (score === 10) return "Perfect score — you know HYROX cold.";
  if (score >= 8) return "Outstanding — you're basically race-ready on the rulebook.";
  if (score >= 5) return "Solid grasp of the format, with room to sharpen up.";
  return "A good starting point — the race format takes a minute to click.";
}

export default function HyroxQuiz() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  function pickAnswer(i: number) {
    if (selected != null) return;
    setSelected(i);
    if (i === question.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  function reset() {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Hyrox Knowledge Quiz" />
      <ScrollView contentContainerStyle={styles.content}>
        {finished ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultScore}>{score}/10</Text>
            <Text style={styles.resultMessage}>{scoreMessage(score)}</Text>
            <Button onPress={reset} accessibilityLabel="Try the quiz again">
              Try Again
            </Button>
          </View>
        ) : (
          <>
            <Text style={styles.progress}>Question {index + 1} of {QUESTIONS.length}</Text>
            <Text style={styles.prompt}>{question.prompt}</Text>
            {question.options.map((option, i) => {
              const isSelected = selected === i;
              const isCorrect = i === question.correctIndex;
              const showState = selected != null && (isSelected || isCorrect);
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.option,
                    showState && isCorrect && styles.optionCorrect,
                    showState && isSelected && !isCorrect && styles.optionWrong,
                  ]}
                  onPress={() => pickAnswer(i)}
                  disabled={selected != null}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
            {selected != null && (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackText}>{question.feedback}</Text>
                <Button onPress={next} accessibilityLabel={isLast ? 'See Results' : 'Next Question'}>
                  {isLast ? 'See Results' : 'Next Question'}
                </Button>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  content: { padding: 20, gap: 12 },
  progress: { fontSize: 12, fontWeight: '700', color: Theme.textMut, letterSpacing: 1, textTransform: 'uppercase' },
  prompt: { fontSize: 20, fontWeight: '700', color: Theme.text, marginBottom: 8 },
  option: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
  },
  optionCorrect: { borderColor: Theme.accent },
  optionWrong: { borderColor: Colors.red },
  optionText: { fontSize: 15, color: Theme.text, fontWeight: '600' },
  feedbackCard: {
    marginTop: 8,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  feedbackText: { fontSize: 14, color: Theme.textSoft, lineHeight: 20 },
  resultCard: { alignItems: 'center', gap: 16, paddingTop: 40 },
  resultScore: { fontSize: 48, fontWeight: '900', color: Theme.accent },
  resultMessage: { fontSize: 16, color: Theme.text, textAlign: 'center' },
});
