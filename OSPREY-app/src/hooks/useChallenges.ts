import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createChallenge,
  deleteChallenge,
  fetchChallengeLeaderboard,
  fetchMyChallenges,
  fetchMyFriends,
  leaveChallenge,
  type CreateChallengeInput,
  type LeaderboardEntry,
  type FriendUser,
  type Challenge,
} from '@/services/challenges';
import { withCache } from '@/services/offline-cache';
import { useAuthStore } from '@/store/authStore';

export function useChallenges() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const listKey = ['challenges', userId];
  const friendsKey = ['my-friends', userId];

  const challenges = useQuery({
    queryKey: listKey,
    queryFn: () => withCache(listKey, () => fetchMyChallenges(userId!)),
    enabled: Boolean(userId),
  });

  const friends = useQuery({
    queryKey: friendsKey,
    queryFn: () => withCache(friendsKey, () => fetchMyFriends(userId!)),
    enabled: Boolean(userId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: listKey });
  }

  const create = useMutation({
    mutationFn: (input: CreateChallengeInput) => createChallenge(userId!, input),
    onSuccess: invalidate,
  });

  const leave = useMutation({
    mutationFn: (challengeId: string) => leaveChallenge(challengeId, userId!),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (challengeId: string) => deleteChallenge(challengeId),
    onSuccess: invalidate,
  });

  return {
    challenges: challenges.data as Challenge[] | undefined,
    friends: friends.data as FriendUser[] | undefined,
    isLoading: challenges.isLoading,
    error: challenges.error,
    create,
    leave,
    remove,
  };
}

export function useChallengeLeaderboard(challengeId: string | null, verifiedOnly = false) {
  const key = ['challenge-leaderboard', challengeId, verifiedOnly];
  return useQuery({
    queryKey: key,
    queryFn: () => fetchChallengeLeaderboard(challengeId!, verifiedOnly),
    enabled: Boolean(challengeId),
    staleTime: 60_000, // refresh at most once per minute
  });
}

export type { Challenge, LeaderboardEntry, FriendUser };
