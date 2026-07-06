import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  removeFriend,
  searchUserByEmail,
  sendFriendRequest,
  type FriendRequest,
  type FriendUser,
} from '@/services/friends';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const friendsKey = ['my-friends', userId];
  const incomingKey = ['friend-requests-incoming', userId];
  const outgoingKey = ['friend-requests-outgoing', userId];

  const friends = useQuery({
    queryKey: friendsKey,
    queryFn: () => withCache(friendsKey, () => fetchFriends(userId!)),
    enabled: Boolean(userId),
  });

  const incomingRequests = useQuery({
    queryKey: incomingKey,
    queryFn: () => withCache(incomingKey, () => fetchIncomingRequests(userId!)),
    enabled: Boolean(userId),
  });

  const outgoingRequests = useQuery({
    queryKey: outgoingKey,
    queryFn: () => withCache(outgoingKey, () => fetchOutgoingRequests(userId!)),
    enabled: Boolean(userId),
  });

  // A friendship being sent/accepted/removed can affect: this screen's own
  // lists, the challenge invite picker (useChallenges' `friendsKey` is also
  // ['my-friends', userId], so invalidating friendsKey covers it too), and the
  // activity feed (which surfaces friends' shared workouts).
  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: friendsKey });
    queryClient.invalidateQueries({ queryKey: incomingKey });
    queryClient.invalidateQueries({ queryKey: outgoingKey });
    queryClient.invalidateQueries({ queryKey: ['activity-feed', userId] });
    // Partial match: invalidates every ['race-friends-at-date', userId, eventDate] entry.
    queryClient.invalidateQueries({ queryKey: ['race-friends-at-date', userId] });
  }

  const sendRequest = useMutation({
    mutationFn: (targetUserId: string) => sendFriendRequest(userId!, targetUserId),
    onSuccess: invalidateAll,
  });

  const accept = useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: invalidateAll,
  });

  const decline = useMutation({
    mutationFn: (requestId: string) => declineFriendRequest(requestId),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: (friendUserId: string) => removeFriend(userId!, friendUserId),
    onSuccess: invalidateAll,
  });

  return {
    friends: friends.data as FriendUser[] | undefined,
    incomingRequests: incomingRequests.data as FriendRequest[] | undefined,
    outgoingRequests: outgoingRequests.data as FriendRequest[] | undefined,
    isLoading: friends.isLoading || incomingRequests.isLoading || outgoingRequests.isLoading,
    error: friends.error ?? incomingRequests.error ?? outgoingRequests.error,
    sendRequest,
    accept,
    decline,
    remove,
  };
}

export { searchUserByEmail };
export type { FriendRequest, FriendUser };
