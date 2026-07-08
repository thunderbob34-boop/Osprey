import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyFriends } from '@/services/challenges';
import {
  acceptFriendRequest,
  declineOrRemoveFriendship,
  fetchPendingRequests,
  removeFriendByUserId,
  sendFriendRequest,
} from '@/services/friends';

export function useFriends(userId: string | undefined) {
  const queryClient = useQueryClient();
  const friendsKey = ['my-friends', userId];
  const pendingKey = ['pending-friend-requests', userId];

  const friends = useQuery({
    queryKey: friendsKey,
    queryFn: () => fetchMyFriends(userId!),
    enabled: Boolean(userId),
  });

  const pending = useQuery({
    queryKey: pendingKey,
    queryFn: () => fetchPendingRequests(userId!),
    enabled: Boolean(userId),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: friendsKey });
    queryClient.invalidateQueries({ queryKey: pendingKey });
  }

  const sendRequest = useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(userId!, addresseeId),
    onSuccess: invalidateAll,
  });

  const acceptRequest = useMutation({
    mutationFn: (friendshipId: string) => acceptFriendRequest(friendshipId),
    onSuccess: invalidateAll,
  });

  const removeFriendship = useMutation({
    mutationFn: (friendshipId: string) => declineOrRemoveFriendship(friendshipId),
    onSuccess: invalidateAll,
  });

  const removeFriend = useMutation({
    mutationFn: (friendUserId: string) => removeFriendByUserId(userId!, friendUserId),
    onSuccess: invalidateAll,
  });

  return {
    friends: friends.data,
    pending: pending.data,
    isLoading: friends.isLoading || pending.isLoading,
    error: friends.error ?? pending.error,
    sendRequest,
    acceptRequest,
    removeFriendship,
    removeFriend,
  };
}
