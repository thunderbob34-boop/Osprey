import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorPanel } from '../../components/ErrorPanel';
import { recipePerServing, useCreateRecipe, useDeleteRecipe, useRecipes } from '../../features/nutrition/recipes';

function RecipeList() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const recipes = useRecipes(userId);
  const create = useCreateRecipe(userId);
  const remove = useDeleteRecipe(userId);

  async function createNew() {
    const r = await create.mutateAsync({ name: 'New recipe', servings: 1 });
    void navigate({ to: '/nutrition/recipes/$recipeId', params: { recipeId: r.id } });
  }

  return (
    <>
      <PageHeader
        eyebrow="Nutrition · Recipes"
        title={<>Your <span className="amber">Recipes</span></>}
        sub="Reusable meals — build once, log a serving in one tap."
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/nutrition" className="btn ghost small">← Fuel Desk</Link>
            <button className="btn small" type="button" disabled={create.isPending} onClick={() => void createNew()}>
              {create.isPending ? 'Creating…' : 'New recipe'}
            </button>
          </div>
        }
      />
      {recipes.isError ? (
        <ErrorPanel error={recipes.error as Error} onRetry={() => void recipes.refetch()} />
      ) : (recipes.data ?? []).length === 0 && !recipes.isLoading ? (
        <EmptyState title="No recipes yet" body="Group foods you eat together into a recipe, then log a serving in one action."
          action={<button className="btn" type="button" style={{ marginTop: 16 }} onClick={() => void createNew()}>Create your first recipe</button>} />
      ) : (
        <div className="card" style={{ padding: '6px 0 6px' }}>
          <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr><th>Recipe</th><th className="num">Servings</th><th className="num">Kcal/srv</th><th className="num">P</th><th className="num">C</th><th className="num">F</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {(recipes.data ?? []).map((r) => {
                const per = r.user_recipe_ingredients.length > 0 ? recipePerServing(r) : null;
                return (
                  <tr key={r.id}>
                    <td><Link className="link-amber" to="/nutrition/recipes/$recipeId" params={{ recipeId: r.id }}>{r.name}</Link></td>
                    <td className="num">{r.servings}</td>
                    <td className="num">{per ? per.calories : '—'}</td>
                    <td className="num">{per ? `${per.proteinG}g` : '—'}</td>
                    <td className="num">{per ? `${per.carbsG}g` : '—'}</td>
                    <td className="num">{per ? `${per.fatG}g` : '—'}</td>
                    <td className="num">
                      <button className="icon-btn" type="button" aria-label={`Delete ${r.name}`} onClick={() => void remove.mutateAsync(r.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute('/_authed/nutrition/recipes/')({ component: RecipeList });
