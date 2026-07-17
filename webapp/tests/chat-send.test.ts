import { describe, it, expect } from 'vitest';
import { httpFailureWasPersisted, ChatSendError } from '../src/features/chat/send';

// The edge function (supabase/functions/ozzie-chat/index.ts) inserts the user's
// turn at index.ts:169 — AFTER the 401/400/404 guards, BEFORE the model call.
// So the HTTP status of a failure tells the client whether the question was
// saved: pre-insert statuses weren't, 502 (model failed after the insert) was.
describe('httpFailureWasPersisted', () => {
  it('treats pre-insert failure statuses as NOT persisted (restore the draft)', () => {
    expect(httpFailureWasPersisted(401)).toBe(false); // missing/invalid auth
    expect(httpFailureWasPersisted(400)).toBe(false); // bad body
    expect(httpFailureWasPersisted(404)).toBe(false); // thread not the caller's
  });

  it('treats 502 (model failed after the insert) as persisted (leave the draft cleared)', () => {
    expect(httpFailureWasPersisted(502)).toBe(true);
  });

  it('treats an ambiguous 500 as persisted — the dominant cause is a post-insert throw, and leaning persisted avoids a duplicate question', () => {
    expect(httpFailureWasPersisted(500)).toBe(true);
  });
});

describe('ChatSendError', () => {
  it('is an Error that carries the persisted flag', () => {
    const persistedErr = new ChatSendError('boom', true);
    expect(persistedErr).toBeInstanceOf(Error);
    expect(persistedErr.persisted).toBe(true);
    expect(persistedErr.message).toBe('boom');

    const lostErr = new ChatSendError('offline', false);
    expect(lostErr.persisted).toBe(false);
  });
});
