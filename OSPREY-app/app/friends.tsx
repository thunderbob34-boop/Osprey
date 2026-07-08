import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useFriends } from '@/hooks/useFriends';
import { normalizePhoneNumber, searchUserByEmailOrPhone, type FriendSearchResult } from '@/services/friends';

function timeAgo(isoStr: string): string {
  const posted = new Date(isoStr);
  const days = Math.floor((Date.now() - posted.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function FriendsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { friends, pending, myPhone, isLoading, sendRequest, acceptRequest, removeFriendship, removeFriend, updatePhone } =
    useFriends(userId);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<FriendSearchResult | null>(null);

  const [phoneInput, setPhoneInput] = useState('');
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Only sync from the server value while the user isn't actively editing —
  // otherwise a background refetch would clobber an in-progress edit.
  useEffect(() => {
    if (!phoneEditing) setPhoneInput(myPhone ?? '');
  }, [myPhone, phoneEditing]);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    setResult(null);
    try {
      const found = await searchUserByEmailOrPhone(trimmed);
      if (!found) {
        setSearchError('No OSPREY user found with that email or phone number.');
      } else {
        setResult(found);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  function handleSavePhone() {
    setPhoneError(null);
    const trimmed = phoneInput.trim();
    if (!trimmed) {
      updatePhone.mutate(null, { onSuccess: () => setPhoneEditing(false) });
      return;
    }
    const normalized = normalizePhoneNumber(trimmed);
    if (!normalized) {
      setPhoneError('Enter a valid phone number, e.g. (555) 123-4567.');
      return;
    }
    updatePhone.mutate(normalized, {
      onSuccess: () => setPhoneEditing(false),
      onError: (err) =>
        setPhoneError(
          err instanceof Error && err.message.toLowerCase().includes('duplicate')
            ? 'Another account already uses that number.'
            : 'Could not save. Try again.',
        ),
    });
  }

  function handleSendRequest() {
    if (!result) return;
    sendRequest.mutate(result.userId, {
      onSuccess: () => setResult({ ...result, friendshipStatus: 'pending' }),
      onError: (err) => Alert.alert('Request failed', err instanceof Error ? err.message : 'Try again.'),
    });
  }

  function handleAccept(friendshipId: string) {
    acceptRequest.mutate(friendshipId, {
      onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Try again.'),
    });
  }

  function handleDecline(friendshipId: string) {
    removeFriendship.mutate(friendshipId, {
      onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Try again.'),
    });
  }

  function handleRemoveFriend(friendUserId: string, friendDisplayName: string) {
    Alert.alert(`Remove ${friendDisplayName}?`, 'You can send a new request later if you change your mind.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeFriend.mutate(friendUserId, {
            onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Try again.'),
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Friends" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            Add friends by email or phone number to share workouts, compete in challenges, and
            sync race days.
          </Text>

          <View style={styles.searchCard}>
            <Text style={styles.fieldLabel}>YOUR PHONE NUMBER</Text>
            <Text style={styles.phoneHint}>So friends can find you by number instead of email.</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Add your phone number"
                placeholderTextColor={Colors.textMuted}
                value={phoneInput}
                onChangeText={(v) => {
                  setPhoneInput(v);
                  setPhoneEditing(true);
                  setPhoneError(null);
                }}
                keyboardType="phone-pad"
                onSubmitEditing={handleSavePhone}
                returnKeyType="done"
                accessibilityLabel="Your phone number"
              />
              {phoneEditing && phoneInput.trim() !== (myPhone ?? '') ? (
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={handleSavePhone}
                  disabled={updatePhone.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Save phone number"
                  accessibilityState={{ disabled: updatePhone.isPending, busy: updatePhone.isPending }}
                >
                  {updatePhone.isPending ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.searchBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
            {phoneError ? <Text style={styles.searchError}>{phoneError}</Text> : null}
          </View>

          <View style={styles.searchCard}>
            <Text style={styles.fieldLabel}>ADD A FRIEND</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Their email or phone number"
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setResult(null);
                  setSearchError(null);
                }}
                autoCapitalize="none"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                accessibilityLabel="Friend's email or phone number"
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                disabled={searching || !query.trim()}
                accessibilityRole="button"
                accessibilityLabel="Search"
                accessibilityState={{ disabled: searching || !query.trim(), busy: searching }}
              >
                {searching ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.searchBtnText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

            {result ? (
              <View style={styles.resultRow}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitial}>{result.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.resultName}>{result.displayName}</Text>
                {result.friendshipStatus === 'accepted' ? (
                  <Text style={styles.resultStatus}>Already friends</Text>
                ) : result.friendshipStatus === 'pending' ? (
                  <Text style={styles.resultStatus}>Request sent</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.addFriendBtn}
                    onPress={handleSendRequest}
                    disabled={sendRequest.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Send friend request to ${result.displayName}`}
                  >
                    <Text style={styles.addFriendBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 24 }} />
          ) : (
            <>
              {pending && pending.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>FRIEND REQUESTS</Text>
                  {pending.map((req) => (
                    <View key={req.friendshipId} style={styles.friendRow}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendInitial}>
                          {req.requesterDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{req.requesterDisplayName}</Text>
                        <Text style={styles.friendMeta}>Requested {timeAgo(req.createdAt)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(req.friendshipId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept ${req.requesterDisplayName}`}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDecline(req.friendshipId)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Decline ${req.requesterDisplayName}`}
                      >
                        <Text style={styles.declineText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={styles.sectionLabel}>YOUR FRIENDS</Text>
              {!friends || friends.length === 0 ? (
                <Text style={styles.empty}>
                  No friends yet. Search their email or phone number above to send a request.
                </Text>
              ) : (
                friends.map((f) => (
                  <View key={f.friendUserId} style={styles.friendRow}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendInitial}>{f.friendDisplayName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.friendName, { flex: 1 }]}>{f.friendDisplayName}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFriend(f.friendUserId, f.friendDisplayName)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${f.friendDisplayName}`}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  subtitle: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },

  searchCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  phoneHint: { fontSize: 12, color: Colors.textMuted, marginTop: -6 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  searchBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  searchError: { color: Colors.red, fontSize: 13 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  resultName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  resultStatus: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  addFriendBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addFriendBtnText: { color: Colors.teal, fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 2,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitial: { color: Colors.teal, fontSize: 15, fontWeight: '800' },
  friendName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  friendMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  acceptBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
  declineText: { color: Colors.textMuted, fontSize: 15, fontWeight: '700' },
  removeText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
});
