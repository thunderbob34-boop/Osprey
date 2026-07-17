import { useState, useRef, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useMessages, useCreateConversation } from '../../features/chat/queries';
import { sendChatMessage } from '../../features/chat/send';
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
      setSendError(err instanceof Error ? err : new Error('Something went wrong.'));
    } finally {
      setStreaming(null);
      setPending(null);
      // The function owns the record, so refetch whatever happened — on a failed
      // answer the question is already saved and reappears from the server
      // rather than vanishing.
      if (conversationId) await qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      await qc.invalidateQueries({ queryKey: ['conversations', userId] });
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Coach" title="Ask Ozzie" sub="Grounded in your plan, zones and recent training." />

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <aside className="detail-card" style={{ flex: '0 0 190px', minWidth: 170 }}>
          <button
            className="btn"
            type="button"
            style={{ width: '100%' }}
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
    </div>
  );
}

export const Route = createFileRoute('/_authed/chat')({ component: ChatPage });
