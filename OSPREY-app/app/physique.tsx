import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { usePhysique } from '@/hooks/usePhysique';
import type { PhysiqueGoal } from '@/services/physique';
import type { ProgressPhoto } from '@/services/physique';

const GOAL_OPTIONS: Array<{ value: PhysiqueGoal; icon: string; label: string; desc: string }> = [
  { value: 'cut', icon: '🔪', label: 'Cut', desc: 'Lean out while protecting muscle and training quality.' },
  { value: 'maintain', icon: '⚖️', label: 'Maintain', desc: 'Hold composition steady while performance climbs.' },
  { value: 'lean_bulk', icon: '📈', label: 'Lean Bulk', desc: 'Add muscle with a controlled surplus, minimal fat.' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function PhysiqueScreen() {
  const router = useRouter();
  const { goal, photos, saveGoal, addPhoto, removePhoto } = usePhysique();

  const [selectedGoal, setSelectedGoal] = useState<PhysiqueGoal | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local form state once from the fetched goal.
  useEffect(() => {
    if (!hydrated && goal.data) {
      setSelectedGoal(goal.data.physiqueGoal);
      setTargetDate(goal.data.physiqueTargetDate ?? '');
      setHydrated(true);
    }
  }, [goal.data, hydrated]);

  async function handleSaveGoal() {
    const trimmed = targetDate.trim();
    if (trimmed && !DATE_RE.test(trimmed)) {
      Alert.alert('Check the date', 'Use YYYY-MM-DD, e.g. 2026-09-01.');
      return;
    }
    try {
      await saveGoal.mutateAsync({ goal: selectedGoal, targetDate: trimmed || null });
      Alert.alert(
        'Saved',
        selectedGoal
          ? "Ozzie's nutrition targets and weekly plans now factor in your physique goal."
          : 'Physique goal cleared — coaching goes back to performance-only.',
      );
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Enable camera access in Settings to take progress photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
        });
      }
      if (result.canceled || !result.assets?.[0]?.uri) return;

      await addPhoto.mutateAsync({ localUri: result.assets[0].uri });
    } catch (err) {
      Alert.alert('Could not add photo', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleDeletePhoto(photo: ProgressPhoto) {
    Alert.alert('Delete photo', `Remove the photo from ${photo.takenOn}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removePhoto.mutate(photo) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Physique</Text>
        <Text style={styles.subtitle}>
          Look like a bodybuilder, function like an athlete. Set the "look" side here — Ozzie
          weighs it against your training (and backs off the deficit around races).
        </Text>

        <Text style={styles.sectionLabel}>PHYSIQUE GOAL</Text>
        {GOAL_OPTIONS.map((option) => {
          const selected = selectedGoal === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.goalCard, selected && styles.goalCardSelected]}
              onPress={() => setSelectedGoal(selected ? null : option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <Text style={styles.goalIcon}>{option.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={styles.goalDesc}>{option.desc}</Text>
              </View>
              {selected ? <Text style={styles.goalCheck}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}

        <Text style={styles.fieldLabel}>Target date (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted}
          value={targetDate}
          onChangeText={setTargetDate}
          autoCapitalize="none"
          accessibilityLabel="Physique goal target date"
        />

        <TouchableOpacity
          style={[styles.saveBtn, saveGoal.isPending && styles.saveBtnDisabled]}
          onPress={handleSaveGoal}
          disabled={saveGoal.isPending || !hydrated}
          accessibilityRole="button"
          accessibilityLabel="Save physique goal"
        >
          {saveGoal.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>Save Goal</Text>
          )}
        </TouchableOpacity>

        <View style={styles.photosHeader}>
          <Text style={styles.sectionLabel}>PROGRESS PHOTOS</Text>
          <View style={styles.photoActions}>
            <TouchableOpacity
              onPress={() => pickPhoto('camera')}
              disabled={addPhoto.isPending}
              accessibilityRole="button"
              accessibilityLabel="Take a progress photo"
            >
              <Text style={styles.photoActionText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickPhoto('library')}
              disabled={addPhoto.isPending}
              accessibilityRole="button"
              accessibilityLabel="Add a progress photo from your library"
            >
              <Text style={styles.photoActionText}>🖼 Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        {addPhoto.isPending ? (
          <ActivityIndicator color={Colors.teal} style={{ marginBottom: 12 }} />
        ) : null}

        {photos.isLoading ? (
          <ActivityIndicator color={Colors.teal} style={{ marginTop: 16 }} />
        ) : photos.error ? (
          <Text style={styles.emptyText}>Couldn't load photos. Pull to retry later.</Text>
        ) : !photos.data || photos.data.length === 0 ? (
          <Text style={styles.emptyText}>
            No photos yet. Same spot, same lighting, every week or two — the mirror lies, the
            timeline doesn't.
          </Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.data.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoCell}
                onLongPress={() => handleDeletePhoto(photo)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Progress photo from ${photo.takenOn}. Long press to delete.`}
              >
                {photo.signedUrl ? (
                  <Image source={{ uri: photo.signedUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoMissing]}>
                    <Text style={styles.photoMissingText}>—</Text>
                  </View>
                )}
                <Text style={styles.photoDate}>{photo.takenOn}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {photos.data && photos.data.length > 0 ? (
          <Text style={styles.footnote}>Long-press a photo to delete it.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', marginBottom: 8 },
  close: { fontSize: 18, color: Colors.textMuted },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 26 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  goalCardSelected: {
    borderColor: Colors.teal,
    backgroundColor: Colors.surfaceTeal,
  },
  goalIcon: { fontSize: 22 },
  goalLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  goalLabelSelected: { color: Colors.textPrimary },
  goalDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
  goalCheck: { fontSize: 16, color: Colors.teal, fontWeight: '700' },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoActions: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  photoActionText: { fontSize: 13, fontWeight: '700', color: Colors.teal },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 8 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  photoCell: { width: '31%' },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
  },
  photoMissing: { alignItems: 'center', justifyContent: 'center' },
  photoMissingText: { color: Colors.textMuted, fontSize: 18 },
  photoDate: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  footnote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
