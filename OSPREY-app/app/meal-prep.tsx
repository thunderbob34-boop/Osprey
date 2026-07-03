import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useMealPlan } from '@/hooks/useMealPlan';
import { buildGroceryExportText, type BudgetPrefs, type GroceryItem } from '@/services/meal-prep';

const SLOT_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🥜',
  'pre-workout': '⚡',
  'post-workout': '💪',
};

const CATEGORY_LABELS: Record<string, string> = {
  protein: 'Protein',
  produce: 'Produce',
  grains: 'Grains',
  dairy: 'Dairy',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
};

function money(n: number | null | undefined): string {
  return n != null ? `$${Number(n).toFixed(2)}` : '—';
}

export default function MealPrepScreen() {
  const router = useRouter();
  const {
    week,
    plan,
    planLoading,
    planError,
    refetchPlan,
    groceries,
    groceriesLoading,
    budget,
    regenerate,
    toggleItem,
    removeItem,
    saveBudget,
  } = useMealPlan();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [dietaryNotes, setDietaryNotes] = useState('');

  function openBudgetEditor() {
    setBudgetAmount(budget?.amount != null ? String(budget.amount) : '');
    setBudgetPeriod(budget?.period ?? 'weekly');
    setDietaryNotes(budget?.dietaryNotes ?? '');
    setEditingBudget(true);
  }

  async function handleSaveBudget() {
    const trimmed = budgetAmount.trim();
    const amount = trimmed ? Number(trimmed) : null;
    if (trimmed && (!isFinite(amount!) || amount! <= 0)) {
      Alert.alert('Check the amount', 'Enter a dollar amount like 85, or leave it blank for no budget.');
      return;
    }
    const prefs: BudgetPrefs = {
      amount,
      period: amount != null ? budgetPeriod : null,
      dietaryNotes: dietaryNotes.trim() || null,
    };
    try {
      await saveBudget.mutateAsync(prefs);
      setEditingBudget(false);
      // Budget changed → today's plan should reflect it.
      Alert.alert('Saved', 'Rebuild today\'s meals with the new budget?', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Rebuild', onPress: () => regenerate.mutate() },
      ]);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleExport() {
    if (!groceries || groceries.length === 0) {
      Alert.alert('Nothing to export', 'Generate a meal plan first — the grocery list builds from it.');
      return;
    }
    try {
      await Share.share({ message: buildGroceryExportText(groceries, week) });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  function handleRegenerate() {
    Alert.alert('Rebuild today\'s meals?', 'Ozzie will plan a fresh day. Checked-off groceries stay checked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rebuild', onPress: () => regenerate.mutate() },
    ]);
  }

  const mealTotals = (plan?.meals ?? []).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
    }),
    { calories: 0, proteinG: 0 },
  );

  const groceryTotal = (groceries ?? []).reduce((s, i) => s + (i.estCost ?? 0), 0);
  const remainingCount = (groceries ?? []).filter((i) => !i.checked).length;

  const grouped = new Map<string, GroceryItem[]>();
  for (const item of groceries ?? []) {
    const key = item.category ?? 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const busy = planLoading || regenerate.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close meal prep"
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Fuel Plan</Text>
        <TouchableOpacity
          onPress={handleRegenerate}
          hitSlop={12}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Rebuild today's meal plan"
        >
          <Text style={[styles.rebuild, busy && { opacity: 0.4 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Budget card ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>GROCERY BUDGET</Text>
            <TouchableOpacity
              onPress={openBudgetEditor}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit grocery budget"
            >
              <Text style={styles.editLink}>{budget?.amount != null ? 'Edit' : 'Set budget'}</Text>
            </TouchableOpacity>
          </View>

          {editingBudget ? (
            <View style={styles.budgetForm}>
              <View style={styles.budgetRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  placeholder="85"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Budget amount in dollars"
                />
                <View style={styles.periodToggle}>
                  {(['weekly', 'monthly'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodChip, budgetPeriod === p && styles.periodChipActive]}
                      onPress={() => setBudgetPeriod(p)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: budgetPeriod === p }}
                    >
                      <Text style={[styles.periodChipText, budgetPeriod === p && styles.periodChipTextActive]}>
                        {p === 'weekly' ? 'Weekly' : 'Monthly'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput
                style={styles.notesInput}
                value={dietaryNotes}
                onChangeText={setDietaryNotes}
                placeholder="Dietary notes — allergies, dislikes, vegetarian…"
                placeholderTextColor={Colors.textMuted}
                multiline
                accessibilityLabel="Dietary notes"
              />
              <View style={styles.budgetActions}>
                <TouchableOpacity onPress={() => setEditingBudget(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveBudget} style={styles.saveBtn} disabled={saveBudget.isPending}>
                  <Text style={styles.saveBtnText}>{saveBudget.isPending ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.budgetSummary}>
              {budget?.amount != null
                ? `${money(budget.amount)} ${budget.period} · ~${money(
                    budget.period === 'weekly' ? budget.amount / 7 : budget.amount / 30,
                  )}/day for food`
                : 'No budget set — Ozzie plans for value, not a cap.'}
            </Text>
          )}
        </View>

        {/* ── Today's meals ───────────────────────────────────── */}
        {busy ? (
          <View style={styles.card}>
            <ActivityIndicator color={Colors.teal} style={{ marginVertical: 24 }} />
            <Text style={styles.loadingText}>
              {regenerate.isPending ? 'Ozzie is rebuilding today\'s meals…' : 'Ozzie is planning today\'s meals…'}
            </Text>
          </View>
        ) : planError ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>Couldn&apos;t load today&apos;s meal plan.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetchPlan()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : plan ? (
          <>
            {plan.ozzieNote ? (
              <View style={styles.ozzieCard}>
                <Text style={styles.ozzieLabel}>OZZIE ON TODAY&apos;S FUEL</Text>
                <Text style={styles.ozzieText}>&ldquo;{plan.ozzieNote}&rdquo;</Text>
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{mealTotals.calories}</Text>
                <Text style={styles.summaryLabel}>kcal planned{plan.target?.calories ? ` / ${plan.target.calories}` : ''}</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{mealTotals.proteinG}g</Text>
                <Text style={styles.summaryLabel}>protein{plan.target?.proteinG ? ` / ${plan.target.proteinG}g` : ''}</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={[styles.summaryValue, { color: Colors.gold }]}>{money(plan.estTotalCost)}</Text>
                <Text style={styles.summaryLabel}>
                  est. day cost{plan.budgetPerDay != null ? ` / ${money(plan.budgetPerDay)}` : ''}
                </Text>
              </View>
            </View>

            {plan.meals.map((meal, i) => (
              <View key={`${meal.slot}-${i}`} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealSlot}>
                    {SLOT_ICONS[meal.slot] ?? '🍴'} {meal.slot.replace('-', ' ').toUpperCase()}
                  </Text>
                  <Text style={styles.mealCost}>{money(meal.estCost)}</Text>
                </View>
                <Text style={styles.mealName}>{meal.name}</Text>
                {meal.description ? <Text style={styles.mealDesc}>{meal.description}</Text> : null}
                <View style={styles.macroRow}>
                  <Text style={styles.macroChip}>{meal.calories} kcal</Text>
                  <Text style={[styles.macroChip, styles.macroProtein]}>{meal.proteinG}g P</Text>
                  <Text style={styles.macroChip}>{meal.carbsG}g C</Text>
                  <Text style={styles.macroChip}>{meal.fatG}g F</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* ── Grocery list ────────────────────────────────────── */}
        <View style={[styles.cardHeaderRow, { marginTop: 24, marginBottom: 10 }]}>
          <Text style={styles.sectionTitle}>
            🛒 Grocery List{groceries && groceries.length > 0 ? ` · ${remainingCount} left` : ''}
          </Text>
          <TouchableOpacity
            onPress={handleExport}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Export grocery list"
          >
            <Text style={styles.editLink}>Export ↗</Text>
          </TouchableOpacity>
        </View>

        {groceriesLoading ? (
          <ActivityIndicator color={Colors.teal} style={{ marginVertical: 16 }} />
        ) : !groceries || groceries.length === 0 ? (
          <Text style={styles.emptyText}>
            No items yet this week — generate a meal plan and the list builds itself.
          </Text>
        ) : (
          <>
            {[...grouped.entries()].map(([category, items]) => (
              <View key={category} style={styles.groceryGroup}>
                <Text style={styles.groceryCategory}>{CATEGORY_LABELS[category] ?? category}</Text>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.groceryRow}
                    onPress={() => toggleItem.mutate({ itemId: item.id, checked: !item.checked })}
                    onLongPress={() =>
                      Alert.alert('Remove item', `Remove ${item.name} from the list?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeItem.mutate(item.id) },
                      ])
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    accessibilityLabel={`${item.name}${item.quantity ? `, ${item.quantity}` : ''}`}
                  >
                    <View style={[styles.checkBubble, item.checked && styles.checkBubbleOn]}>
                      {item.checked ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.groceryName, item.checked && styles.groceryNameDone]}>
                        {item.name}
                      </Text>
                      {item.quantity ? <Text style={styles.groceryQty}>{item.quantity}</Text> : null}
                    </View>
                    <Text style={styles.groceryCost}>{money(item.estCost)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.groceryTotalRow}>
              <Text style={styles.groceryTotalLabel}>Est. total (prices are estimates)</Text>
              <Text style={styles.groceryTotalValue}>{money(groceryTotal)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  close: { fontSize: 18, color: Colors.textMuted, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  rebuild: { fontSize: 20, color: Colors.teal, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48 },

  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  editLink: { fontSize: 13, fontWeight: '700', color: Colors.teal },
  budgetSummary: { fontSize: 13.5, color: Colors.textSecondary, marginTop: 8, lineHeight: 19 },

  budgetForm: { marginTop: 12, gap: 10 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dollarSign: { fontSize: 18, fontWeight: '800', color: Colors.textSecondary },
  budgetInput: {
    width: 90,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  periodToggle: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  periodChipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  periodChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.textMuted },
  periodChipTextActive: { color: Colors.teal },
  notesInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 13.5,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  budgetActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13.5, fontWeight: '700', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.teal,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 13.5, fontWeight: '800', color: '#000' },

  ozzieCard: {
    backgroundColor: Colors.surfaceGold,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  ozzieLabel: { fontSize: 10, fontWeight: '700', color: Colors.gold, letterSpacing: 1, marginBottom: 5 },
  ozzieText: { fontSize: 13.5, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryBlock: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 17, fontWeight: '800', color: Colors.teal },
  summaryLabel: { fontSize: 10.5, color: Colors.textMuted, marginTop: 3, textAlign: 'center' },

  mealCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mealSlot: { fontSize: 10.5, fontWeight: '700', color: Colors.teal, letterSpacing: 0.8 },
  mealCost: { fontSize: 12.5, fontWeight: '700', color: Colors.gold },
  mealName: { fontSize: 15.5, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  mealDesc: { fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  macroChip: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  macroProtein: { color: Colors.teal, backgroundColor: Colors.surfaceTeal },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 4 },
  loadingText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 },
  errorText: { fontSize: 13.5, color: Colors.textMuted, marginBottom: 12 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },

  groceryGroup: { marginBottom: 14 },
  groceryCategory: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
    flex: undefined,
  },
  checkBubbleOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  checkMark: { fontSize: 13, fontWeight: '900', color: '#000' },
  groceryName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  groceryNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  groceryQty: { fontSize: 11.5, color: Colors.textMuted, marginTop: 1 },
  groceryCost: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },

  groceryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  groceryTotalLabel: { fontSize: 12, color: Colors.textMuted },
  groceryTotalValue: { fontSize: 15, fontWeight: '800', color: Colors.gold },
});
