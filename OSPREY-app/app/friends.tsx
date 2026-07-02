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
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useFriends } from '@/hooks/useFriends';
import type { FoundUser } from '@/services/friends';

export default function FriendsScreen() {
  const router = useRouter();
  const { friends, friendsLoading, pending, pendingLoading, findUserByEmail, sendRequest, respond, cancelRequest, remove } =
    useFriends();

  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<FoundUser | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearch() {
    if (!email.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const result = await findUserByEmail(email);
      if (!result) {
        setSearchError("No OSPREY athlete found with that email.");
      } else {
        setSearchResult(result);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest() {
    if (!searchResult) return;
    try {
      await sendRequest.mutateAsync(searchResult);
      setSearchResult(null);
      setEmail('');
    } catch (err) {
      Alert.alert('Could not send request', err instanceof Error ? err.message : 'Try again.');
    }
  }

  const incoming = pending.filter((p) => p.direction === 'incoming');
  const outgoing = pending.filter((p) => p.direction === 'outgoing');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>ADD A FRIEND</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Their email"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setSearchResult(null);
                setSearchError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
            </TouchableOpacity>
          </View>

          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

          {searchResult ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultName}>{searchResult.displayName}</Text>
              {searchResult.status === 'none' ? (
                <TouchableOpacity style={styles.addBtn} onPress={handleSendRequest} disabled={sendRequest.isPending}>
                  {sendRequest.isPending ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.addBtnText}>Add Friend</Text>
                  )}
                </TouchableOpacity>
              ) : searchResult.status === 'pending_received' ? (
                <TouchableOpacity style={styles.addBtn} onPress={handleSendRequest} disabled={sendRequest.isPending}>
                  <Text style={styles.addBtnText}>Accept Request</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resultStatus}>
                  {searchResult.status === 'pending_sent'
                    ? 'Request sent'
                    : searchResult.status === 'accepted'
                      ? 'Already friends'
                      : 'Unavailable'}
                </Text>
              )}
            </View>
          ) : null}

          {incoming.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>REQUESTS</Text>
              {incoming.map((req) => (
                <View key={req.friendshipId} style={styles.row}>
                  <Text style={styles.rowName}>{req.otherDisplayName}</Text>
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respond.mutate({ friendshipId: req.friendshipId, action: 'accept' })}
                    >
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => respond.mutate({ friendshipId: req.friendshipId, action: 'decline' })}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {outgoing.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>SENT</Text>
              {outgoing.map((req) => (
                <View key={req.friendshipId} style={styles.row}>
                  <Text style={styles.rowName}>{req.otherDisplayName}</Text>
                  <TouchableOpacity onPress={() => cancelRequest.mutate(req.friendshipId)}>
                    <Text style={styles.declineText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.sectionLabel}>YOUR CREW</Text>
          {friendsLoading || pendingLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 12 }} />
          ) : friends.length === 0 ? (
            <Text style={styles.empty}>
              No friends yet. Add someone by email above to share workouts and join challenges together.
            </Text>
          ) : (
            friends.map((friend) => (
              <View key={friend.friendUserId} style={styles.row}>
                <Text style={styles.rowName}>{friend.friendDisplayName}</Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Remove friend?', `Remove ${friend.friendDisplayName} from your crew?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(friend.friendUserId) },
                    ])
                  }
                >
                  <Text style={styles.declineText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  close: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  errorText: { color: Colors.red, fontSize: 13, marginTop: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  resultName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  resultStatus: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  addBtn: { backgroundColor: Colors.teal, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  acceptBtn: { backgroundColor: Colors.teal, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  declineText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
});
