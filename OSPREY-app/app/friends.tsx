import { useState } from 'react';
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
import FieldError from '@/components/FieldError';
import ScreenHeader from '@/components/ScreenHeader';
import { useFriends } from '@/hooks/useFriends';
import { searchUserByEmail } from '@/services/friends';

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function FriendsScreen() {
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    error,
    sendRequest,
    accept,
    decline,
    remove,
  } = useFriends();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleAdd() {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setSearching(true);
    try {
      const found = await searchUserByEmail(trimmed);
      if (!found) {
        setEmailError('No OSPREY user found with that email.');
        return;
      }
      const alreadyFriend = friends?.some((f) => f.friendUserId === found.id);
      const alreadyRequested = outgoingRequests?.some((r) => r.otherUserId === found.id);
      const alreadyIncoming = incomingRequests?.some((r) => r.otherUserId === found.id);
      if (alreadyFriend) {
        setEmailError(`You're already friends with ${found.displayName}.`);
        return;
      }
      if (alreadyRequested) {
        setEmailError(`You already sent ${found.displayName} a request.`);
        return;
      }
      if (alreadyIncoming) {
        setEmailError(`${found.displayName} already sent you a request — check below.`);
        return;
      }
      await sendRequest.mutateAsync(found.id);
      setEmail('');
      Alert.alert('Request sent', `Friend request sent to ${found.displayName}.`);
    } catch (err) {
      Alert.alert('Add friend failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSearching(false);
    }
  }

  function handleAccept(requestId: string, name: string) {
    accept.mutate(requestId, {
      onError: (err) =>
        Alert.alert('Accept failed', err instanceof Error ? err.message : `Could not accept ${name}.`),
    });
  }

  function handleDecline(requestId: string, name: string) {
    Alert.alert('Decline request?', `Decline the friend request from ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: () =>
          decline.mutate(requestId, {
            onError: (err) =>
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not decline.'),
          }),
      },
    ]);
  }

  function handleCancelOutgoing(requestId: string, name: string) {
    Alert.alert('Cancel request?', `Cancel your friend request to ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: () =>
          decline.mutate(requestId, {
            onError: (err) =>
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel.'),
          }),
      },
    ]);
  }

  function handleRemoveFriend(friendUserId: string, name: string) {
    Alert.alert('Remove friend?', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(friendUserId, {
            onError: (err) =>
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove friend.'),
          }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Friends" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ── Add friend ── */}
          <View style={styles.addCard}>
            <Text style={styles.sectionLabel}>ADD A FRIEND</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="Friend's email address"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setEmailError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                accessibilityLabel="Friend's email address"
              />
              <TouchableOpacity
                style={[styles.addBtn, (searching || sendRequest.isPending) && styles.addBtnDisabled]}
                onPress={handleAdd}
                disabled={searching || sendRequest.isPending}
                accessibilityRole="button"
                accessibilityLabel="Send friend request"
                accessibilityState={{ disabled: searching || sendRequest.isPending, busy: searching || sendRequest.isPending }}
              >
                {searching || sendRequest.isPending ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.addBtnText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            <FieldError message={emailError} />
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load friends.</Text>
          ) : (
            <>
              {/* ── Incoming requests ── */}
              {incomingRequests && incomingRequests.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>REQUESTS</Text>
                  {incomingRequests.map((r) => (
                    <View key={r.requestId} style={styles.row}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {r.otherDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {r.otherDisplayName}
                      </Text>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          onPress={() => handleAccept(r.requestId, r.otherDisplayName)}
                          disabled={accept.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={`Accept friend request from ${r.otherDisplayName}`}
                        >
                          <Text style={styles.acceptText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDecline(r.requestId, r.otherDisplayName)}
                          disabled={decline.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={`Decline friend request from ${r.otherDisplayName}`}
                        >
                          <Text style={styles.declineText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              {/* ── Outgoing requests ── */}
              {outgoingRequests && outgoingRequests.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>SENT</Text>
                  {outgoingRequests.map((r) => (
                    <View key={r.requestId} style={styles.row}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {r.otherDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {r.otherDisplayName}
                      </Text>
                      <Text style={styles.pendingLabel}>Pending</Text>
                      <TouchableOpacity
                        onPress={() => handleCancelOutgoing(r.requestId, r.otherDisplayName)}
                        disabled={decline.isPending}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel friend request to ${r.otherDisplayName}`}
                      >
                        <Text style={styles.declineText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : null}

              {/* ── Friends list ── */}
              <Text style={styles.sectionLabel}>FRIENDS</Text>
              {friends && friends.length > 0 ? (
                friends.map((f) => (
                  <View key={f.friendUserId} style={styles.row}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {f.friendDisplayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {f.friendDisplayName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFriend(f.friendUserId, f.friendDisplayName)}
                      disabled={remove.isPending}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${f.friendDisplayName} from friends`}
                    >
                      <Text style={styles.declineText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>
                  No friends yet. Add a friend by email above to compete in challenges,
                  train together at races, and see their activity.
                </Text>
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
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },

  // ── Add friend ──
  addCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  inputError: { borderColor: Colors.red },
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
  addBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  // ── Rows ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.teal, fontSize: 15, fontWeight: '800' },
  rowName: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pendingLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 4 },
  actionRow: { flexDirection: 'row', gap: 16 },
  acceptText: { color: Colors.teal, fontSize: 13, fontWeight: '700' },
  declineText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
});
