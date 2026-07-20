import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useUnits, useUpdateUnits, useLocationZip, useUpdateLocationZip } from '../../features/settings/queries';
import { useUserProfile } from '../../lib/useAuthUser';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';
import { TrainingZonesCard } from '../../features/settings/TrainingZonesCard';
import { friendlyMessage } from '../../lib/errorMessage';

const TIER_LABEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function LocationCard({ userId }: { userId: string }) {
  const zip = useLocationZip(userId);
  const update = useUpdateLocationZip(userId);
  const [draft, setDraft] = useState('');

  useEffect(() => { if (zip.data) setDraft(zip.data); }, [zip.data]);

  const isValidZip = /^\d{5}$/.test(draft.trim());

  return (
    <div className="card">
      <div className="settings-row">
        <span className="k">Zip code</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 28202"
            style={{ width: 120 }}
            inputMode="numeric"
          />
          <button
            className="btn"
            type="button"
            disabled={update.isPending || !isValidZip || draft === (zip.data ?? '')}
            onClick={() => update.mutate(draft.trim())}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--mut)', fontSize: 12, marginTop: 10 }}>Used to find real tune-up races near you on the Calendar.</p>
      {update.isError && <p className="err-line" role="alert" style={{ marginTop: 10 }}>{friendlyMessage(update.error)}</p>}
    </div>
  );
}

function SettingsPage() {
  const { userId } = Route.useRouteContext();
  const { data: profile } = useUserProfile();
  const units = useUnits(userId);
  const update = useUpdateUnits(userId);

  return (
    <>
      <PageHeader eyebrow="Your account" title="Settings" />

      {profile && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="settings-row">
            <span className="k">Name</span>
            <span className="v">{profile.display_name}</span>
          </div>
          <div className="settings-row">
            <span className="k">Email</span>
            <span className="v">{profile.email}</span>
          </div>
          <div className="settings-row">
            <span className="k">Experience</span>
            <span className="v">{TIER_LABEL[profile.experience_tier]}</span>
          </div>
        </div>
      )}

      {units.isPending && <p className="loading-line">Loading…</p>}
      {units.isError && <ErrorPanel error={units.error as Error} onRetry={() => void units.refetch()} />}

      {units.isSuccess && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="settings-row">
            <span className="k">Units</span>
            <div className="toggle-group">
              {(['imperial', 'metric'] as const).map((u) => (
                <button
                  key={u}
                  className={units.data === u ? 'active' : ''}
                  onClick={() => update.mutate(u)}
                  disabled={update.isPending}
                >
                  {u === 'imperial' ? 'Imperial' : 'Metric'}
                </button>
              ))}
            </div>
          </div>
          {update.isError && <p className="err-line" role="alert" style={{ marginTop: 12 }}>{friendlyMessage(update.error)}</p>}
        </div>
      )}

      <LocationCard userId={userId} />

      <div style={{ marginTop: 24 }}>
        <TrainingZonesCard userId={userId} />
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/settings')({ component: SettingsPage });
