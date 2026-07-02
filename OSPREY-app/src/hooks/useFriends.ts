import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelFriendRequest,
  fetchMyFriends,
  fetchPendingFriendRequests,
  findUserByEmail,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  type FoundUser,
} from '@/services/friends';
import { useAuthStore } from '@/store/authStore';

export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const friendsKey = ['friends', userId];
  const pendingKey = ['friend-requests', userId];

  const friends = useQuery({
    queryKey: friendsKey,
    queryFn: () => fetchMyFriends(userId!),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  const pending = useQuery({
    queryKey: pendingKey,
    queryFn: fetchPendingFriendRequests,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: friendsKey });
    queryClient.invalidateQueries({ queryKey: pendingKey });
  }

  const sendRequest = useMutation({
    mutationFn: (target: FoundUser) => sendFriendRequest(userId!, target),
    onSuccess: invalidate,
  });

  const respond = useMutation({
    mutationFn: ({ friendshipId, action }: { friendshipId: string; action: 'accept' | 'decline' }) =>
      respondToFriendRequest(friendshipId, action),
    onSuccess: invalidate,
  });

  const cancelRequest = useMutation({
    mutationFn: (friendshipId: string) => cancelFriendRequest(friendshipId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (friendUserId: string) => removeFriend(userId!, friendUserId),
    onSuccess: invalidate,
  });

  return {
    friends: friends.data ?? [],
    friendsLoading: friends.isLoading,
    friendsError: friends.error,
    pending: pending.data ?? [],
    pendingLoading: pending.isLoading,
    findUserByEmail,
    sendRequest,
    respond,
    cancelRequest,
    remove,
  };
}
