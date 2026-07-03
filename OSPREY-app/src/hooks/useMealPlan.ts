import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBudgetPrefs,
  fetchGroceryList,
  fetchMealPlan,
  removeGroceryItem,
  saveBudgetPrefs,
  setGroceryItemChecked,
  todayLocal,
  weekOfLocal,
  type BudgetPrefs,
  type GroceryItem,
} from '@/services/meal-prep';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useMealPlan() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const planDate = todayLocal();
  const week = weekOfLocal(planDate);

  const planKey = ['meal-plan', userId, planDate];
  const groceryKey = ['grocery-list', userId, week];
  const budgetKey = ['budget-prefs', userId];

  const plan = useQuery({
    queryKey: planKey,
    queryFn: () => withCache(planKey, () => fetchMealPlan(planDate)),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
  });

  const groceries = useQuery({
    queryKey: groceryKey,
    queryFn: () => withCache(groceryKey, () => fetchGroceryList(userId!, week)),
    enabled: Boolean(userId),
  });

  const budget = useQuery({
    queryKey: budgetKey,
    queryFn: () => fetchBudgetPrefs(userId!),
    enabled: Boolean(userId),
  });

  const regenerate = useMutation({
    mutationFn: () => fetchMealPlan(planDate, true),
    onSuccess: (fresh) => {
      queryClient.setQueryData(planKey, fresh);
      queryClient.invalidateQueries({ queryKey: groceryKey });
    },
  });

  const toggleItem = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      setGroceryItemChecked(itemId, checked),
    // Optimistic: the in-store checklist has to feel instant on gym-basement
    // grocery wifi. Roll back on error.
    onMutate: async ({ itemId, checked }) => {
      await queryClient.cancelQueries({ queryKey: groceryKey });
      const previous = queryClient.getQueryData<GroceryItem[]>(groceryKey);
      queryClient.setQueryData<GroceryItem[]>(groceryKey, (items) =>
        (items ?? []).map((i) => (i.id === itemId ? { ...i, checked } : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(groceryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groceryKey }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => removeGroceryItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groceryKey }),
  });

  const saveBudget = useMutation({
    mutationFn: (prefs: BudgetPrefs) => saveBudgetPrefs(userId!, prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKey }),
  });

  return {
    planDate,
    week,
    plan: plan.data,
    planLoading: plan.isLoading,
    planError: plan.error,
    refetchPlan: plan.refetch,
    groceries: groceries.data as GroceryItem[] | undefined,
    groceriesLoading: groceries.isLoading,
    budget: budget.data as BudgetPrefs | undefined,
    regenerate,
    toggleItem,
    removeItem,
    saveBudget,
  };
}
