import { useState, useRef, useEffect } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useMessages, useCreateConversation } from '../../features/chat/queries';
import { sendChatMessage, ChatSendError } from '../../features/chat/send';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';

const MAX_MESSAGE = 2000;

function ChatPage() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const conversations = useConversations(userId);
  const createConversation = useCreateConversation(userId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // The question being answered right now. Rendered optimistically because the
  // thread hasn't refetched yet — without this the athlete's own message
  // disappears the moment they hit Send.
  const [pending, setPending] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Error | null>(null);

  const messages = useMessages(activeId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view as tokens land.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data, streaming]);

  const busy = streaming !== null || createConversation.isPending;

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy) return;

    setSendError(null);
    setDraft('');
    setPending(text);
    setStreaming('');

    let conversationId: string | null = activeId;
    try {
      // A thread is created on the first send, not on "+ New chat", so an
      // abandoned empty thread never reaches the database.
      if (!conversationId) {
        conversationId = (await createConversation.mutateAsync({ firstMessage: text })).id;
        setActiveId(conversationId);
      }

      await sendChatMessage({
        conversationId,
        message: text,
        onToken: (token) => setStreaming((prev) => (prev ?? '') + token),
      });
    } catch (err) {
      // Give the athlete their text back only when the question wasn't saved.
      // A ChatSendError with persisted=true (a 502, or the connection dropping
      // mid-reply) means the turn is already in the thread and the refetch below
      // will show it — restoring the composer there would invite a duplicate
      // re-send. Everything else (createConversation failed, offline, 401/400/404)
      // never saved the turn, so returning the draft is safe and kind.
      if (!(err instanceof ChatSendError && err.persisted)) setDraft(text);
      setSendError(err instanceof Error ? err : new Error('Something went wrong.'));
    } finally {
      // The function owns the record, so refetch whatever happened — on a failed
      // answer the question is already saved and reappears from the server. Await
      // the refetch BEFORE clearing the optimistic bubbles so the real messages
      // are already in `messages.data` when `pending`/`streaming` disappear —
      // otherwise there's a gap (a few hundred ms) where neither the optimistic
      // nor the server copy is on screen and the just-sent turn appears to vanish.
      if (conversationId) await qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      await qc.invalidateQueries({ queryKey: ['conversations', userId] });
      setStreaming(null);
      setPending(null);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Coach" title="Ask Ozzie" sub="Grounded in your plan, zones and recent training." />

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <aside className="detail-card" style={{ flex: '0 0 190px', minWidth: 170 }}>
          <button
            className="btn"
            type="button"
            style={{ width: '100%' }}
            // Disabled mid-send: a send in flight owns the page's streaming state,
            // and switching threads while it's in flight would strand its "Sending…"
            // status on the newly-active thread and leak its bubble into this view.
            disabled={busy}
            onClick={() => { setActiveId(null); setStreaming(null); setSendError(null); }}
          >
            + New chat
          </button>

          {conversations.isError && <ErrorPanel error={conversations.error as Error} onRetry={() => void conversations.refetch()} />}
          {conversations.data?.length === 0 && <p className="muted">No saved chats yet.</p>}

          {conversations.data?.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => { setActiveId(c.id); setSendError(null); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'none', border: 'none', padding: '8px 4px',
                fontWeight: c.id === activeId ? 700 : 400,
              }}
            >
              {c.title}
            </button>
          ))}
        </aside>

        <section className="detail-card" style={{ flex: 1, minWidth: 290, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeId == null && pending == null && (
              <p className="muted">Ask Ozzie why a session looks the way it does, how to fuel it, or what to do when the week goes sideways.</p>
            )}

            {messages.isError && <ErrorPanel error={messages.error as Error} onRetry={() => void messages.refetch()} />}

            {messages.data?.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>{m.content}</p>
              ) : (
                <div key={m.id} className="ozzie-note" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>{m.content}</div>
              ),
            )}

            {pending !== null && (
              <p style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>{pending}</p>
            )}

            {streaming !== null && (
              <div className="ozzie-note" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                {streaming === '' ? <span className="muted">Ozzie is thinking…</span> : streaming}
              </div>
            )}
          </div>

          {/* No onRetry: the function already persisted the question, so a
              re-send would duplicate it in the thread. They can ask again. */}
          {sendError && <ErrorPanel error={sendError} />}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
            <textarea
              value={draft}
              maxLength={MAX_MESSAGE}
              placeholder="Ask Ozzie about your training…"
              style={{ flex: 1, minHeight: 38 }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
              }}
            />
            <button className="btn" type="button" disabled={!draft.trim() || busy} onClick={() => void handleSend()}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/chat')({
  // Chat is hidden until OpenAI billing is turned on: the nav link is removed
  // (NavRail.tsx) and any direct hit on /chat bounces to the dashboard, so it
  // can't be reached or run up OpenAI usage. Re-enable: delete this beforeLoad
  // and restore the nav link. ChatPage below is left fully intact.
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
  component: ChatPage,
});
