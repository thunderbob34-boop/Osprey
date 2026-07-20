import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { parseListLenient } from '../../lib/schemas';
import { titleFromFirstMessage } from './model';

const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** The athlete's saved threads, most recently active first. */
export function useConversations(userId: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('ozzie_conversations')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return parseListLenient(ConversationSchema, data ?? []);
    },
  });
}

/** One thread's messages, oldest first. Disabled until a thread is selected. */
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: conversationId != null,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('ozzie_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return parseListLenient(ChatMessageSchema, data ?? []);
    },
  });
}

/**
 * Starts a thread. Called on the first send rather than when "+ New chat" is
 * clicked, so an abandoned empty thread never reaches the database.
 */
export function useCreateConversation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ firstMessage }: { firstMessage: string }): Promise<Conversation> => {
      const { data, error } = await supabase
        .from('ozzie_conversations')
        .insert({ user_id: userId, title: titleFromFirstMessage(firstMessage) })
        .select('id, title, updated_at')
        .single();
      if (error) throw error;
      return ConversationSchema.parse(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });
}
