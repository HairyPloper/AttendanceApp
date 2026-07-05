import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CombinedRankingItem,
  getEventList,
  getLeaderboard,
  RankingItem,
  RankingsData,
} from '../../components/api';
import { buildCombinedRanking } from '../../components/attendanceUtils';
import { CACHE_KEYS, getWithExpiry, saveWithExpiry } from '../../components/storageHelper';
import { sharedStyles } from '../../components/styles';
import { EmptyState, LoadingState, PaginationControls } from '../../components/ui';

const HOST_LOCATION_MAP: { user: string; location: string }[] = [
  { user: 'Pako', location: 'PAKISTAN' },
  { user: 'Makaron', location: 'MAKISTAN' },
  { user: 'Miky', location: 'MYKYSTAN' },
  { user: 'Shomi', location: 'SOMISTAN' },
  { user: 'Toške', location: 'TOSESTAN' },
  { user: 'Anton', location: 'ANTONSTAN' },
  { user: 'Dady', location: 'DADYSTAN' },
];

const PROFILE_ICON_MAP: { user: string; icon: string }[] = [
  { user: 'Pako', icon: '🦀' },
  { user: 'Makaron', icon: '🪑' },
  { user: 'Miky', icon: '🐦‍⬛' },
  { user: 'Shomi', icon: '🎲' },
  { user: 'Toške', icon: '🔥' },
  { user: 'Anton', icon: '🏴‍☠️' },
  { user: 'Dady', icon: '🍔' },
  { user: 'Pjeki', icon: '👥' },
  { user: 'Nena', icon: '🎓' },
  { user: 'Emilija', icon: '🍓' },
  { user: 'Džoni', icon: '🍆' },
  { user: 'Nini', icon: '🥷🏻' },
  { user: 'Dika Bulevarac', icon: '👨‍🦯' },
  { user: 'Dincha', icon: '🐈' },
];

const emptyRankings: RankingsData = { userRanking: [], locationRanking: [] };
const rowsPerPage = 7;

const getInitials = (name: string): string => {
  const mapping = PROFILE_ICON_MAP.find((m) => m.user.toLowerCase() === name.toLowerCase());
  if (mapping) return mapping.icon;

  const words = name.trim().split(' ');
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
    '#F8B739',
    '#52B788',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Leaderboard() {
  const isFocused = useIsFocused();
  const [data, setData] = useState<RankingsData>(emptyRankings);
  const [allTimeData, setAllTimeData] = useState<RankingsData>(emptyRankings);
  const [eventList, setEventList] = useState<string[]>(['Ukupno']);
  const [selectedEvent, setSelectedEvent] = useState<string>('Ukupno');
  const [loadingTop, setLoadingTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'smiberi' | 'ugostitelj' | 'total'>('smiberi');
  const [userPage, setUserPage] = useState(1);
  const [locPage, setLocPage] = useState(1);
  const [statusText, setStatusText] = useState<string | null>(null);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * rowsPerPage;
    return data.userRanking.slice(start, start + rowsPerPage);
  }, [data.userRanking, userPage]);
  const totalUserPages = Math.ceil(data.userRanking.length / rowsPerPage) || 1;

  const paginatedLocations = useMemo(() => {
    const start = (locPage - 1) * rowsPerPage;
    return data.locationRanking.slice(start, start + rowsPerPage);
  }, [data.locationRanking, locPage]);
  const totalLocPages = Math.ceil(data.locationRanking.length / rowsPerPage) || 1;

  const combinedRanking = useMemo(
    () => buildCombinedRanking(allTimeData, HOST_LOCATION_MAP),
    [allTimeData]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadEventList();
      fetchRankings(selectedEvent, true);
    }
  }, [isFocused, selectedEvent]);

  const loadEventList = async () => {
    const cached = await getWithExpiry<string[]>(CACHE_KEYS.eventList);
    if (cached) setEventList(cached);

    try {
      const fresh = ['Ukupno', ...(await getEventList())];
      setEventList(fresh);
      await saveWithExpiry(CACHE_KEYS.eventList, fresh, 60);
    } catch {
      if (!cached) setStatusText('Lista događaja trenutno nije dostupna.');
    }
  };

  const fetchRankings = async (eventFilter: string, allowCache: boolean) => {
    setLoadingTop(true);
    setStatusText(null);
    const cacheKey = CACHE_KEYS.leaderboard(eventFilter);

    if (allowCache) {
      const cached = await getWithExpiry<RankingsData>(cacheKey);
      if (cached) {
        setData(cached);
        if (eventFilter === 'Ukupno') setAllTimeData(cached);
        setStatusText('Prikazujem keširane podatke dok osvežavam.');
      }
    }

    try {
      const fresh = await getLeaderboard(eventFilter);
      setData(fresh);
      setUserPage(1);
      setLocPage(1);
      await saveWithExpiry(cacheKey, fresh, 5);

      if (eventFilter === 'Ukupno') {
        setAllTimeData(fresh);
      } else if (allTimeData.userRanking.length === 0) {
        const totalFresh = await getLeaderboard('Ukupno');
        setAllTimeData(totalFresh);
        await saveWithExpiry(CACHE_KEYS.leaderboard('Ukupno'), totalFresh, 5);
      }

      setStatusText(null);
    } catch {
      setStatusText('Ne mogu da osvežim rang listu. Pokušaj ponovo.');
    } finally {
      setLoadingTop(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadEventList();
    fetchRankings(selectedEvent, false);
  };

  const renderRankRow = (item: RankingItem, rank: number) => (
    <View key={`${item.name}-${rank}`} style={styles.remainingRow}>
      <View style={styles.remainingLeft}>
        <Text style={styles.remainingRank}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
        </Text>
        <View style={styles.remainingInfo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.remainingName}>{item.name}</Text>
            <Text style={styles.remainingStats}>{item.timeStr}</Text>
          </View>
        </View>
        <View style={localStyles.dayBadge}>
          <Text style={localStyles.dayBadgeText}>{item.total}x</Text>
        </View>
      </View>
    </View>
  );

  const renderTopThree = (rankings: CombinedRankingItem[]) => {
    if (rankings.length === 0) return <EmptyState label="Nema podataka..." />;

    const topThree = rankings.slice(0, 3);
    const positions = [1, 0, 2];

    return (
      <View style={styles.podiumContainer}>
        <View style={styles.topThreeRow}>
          {positions.map((index) => {
            const person = topThree[index];
            if (!person) return null;

            const rank = index + 1;
            const size = rank === 1 ? 100 : 85;
            const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
            const initials = getInitials(person.name);
            const bgColor = getAvatarColor(person.name);

            return (
              <View key={person.name} style={[styles.podiumItem, rank === 1 && styles.podiumFirst]}>
                <View style={[styles.avatarContainer, { width: size, height: size }]}>
                  <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}>
                    <Text style={[styles.initialsText, { fontSize: size / 3 }]}>{initials}</Text>
                  </View>
                  <View style={[styles.rankBadge, { backgroundColor: medalColor }]}>
                    <Text style={styles.rankNumber}>{rank}</Text>
                  </View>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {person.name}
                </Text>
                <Text style={styles.podiumPoints}>{person.timeStr}</Text>
                <Text style={styles.podiumTime}>{person.total}x</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderRemainingRanks = (rankings: CombinedRankingItem[]) => {
    if (rankings.length <= 3) return null;

    return (
      <View style={styles.remainingContainer}>
        {rankings.slice(3, 10).map((person, index) => {
          const rank = index + 4;
          const initials = getInitials(person.name);
          const bgColor = getAvatarColor(person.name);

          return (
            <View key={person.name} style={styles.remainingRow}>
              <View style={styles.remainingLeft}>
                <Text style={styles.remainingRank}>{rank}.</Text>
                <View style={styles.smallAvatarContainer}>
                  <View style={[styles.smallAvatarCircle, { backgroundColor: bgColor }]}>
                    <Text style={styles.smallInitialsText}>{initials}</Text>
                  </View>
                </View>
                <View style={styles.remainingInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.remainingName}>{person.name}</Text>
                    <Text style={styles.remainingStats}>
                      {person.timeStr} • {person.total}x
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (!isClient) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'smiberi' && styles.activeTab]}
          onPress={() => setActiveTab('smiberi')}
        >
          <Text style={[styles.tabText, activeTab === 'smiberi' && styles.activeTabText]}>
            👑 Šmiberi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ugostitelj' && styles.activeTab]}
          onPress={() => setActiveTab('ugostitelj')}
        >
          <Text style={[styles.tabText, activeTab === 'ugostitelj' && styles.activeTabText]}>
            📍 Ugostitelji
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'total' && styles.activeTab]}
          onPress={() => setActiveTab('total')}
        >
          <Text style={[styles.tabText, activeTab === 'total' && styles.activeTabText]}>
            🍹 Osveženje
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={sharedStyles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {statusText && <Text style={styles.statusText}>{statusText}</Text>}

        {activeTab === 'smiberi' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.tabHeaderRow}>
              <Text style={localStyles.sectionTitle}>👑 Naj Šmiberi</Text>
              <View style={sharedStyles.modernPickerWrapper}>
                <View style={sharedStyles.visualPickerContainer}>
                  <Text style={sharedStyles.pickerText} numberOfLines={1}>
                    {selectedEvent}
                  </Text>
                  <Text style={sharedStyles.chevronIcon}>{'\uf0d7'}</Text>
                </View>
                <Picker
                  selectedValue={selectedEvent}
                  style={sharedStyles.invisiblePicker}
                  onValueChange={(val) => setSelectedEvent(String(val))}
                >
                  {eventList.map((evt) => (
                    <Picker.Item key={evt} label={evt} value={evt} />
                  ))}
                </Picker>
              </View>
            </View>

            {loadingTop && paginatedUsers.length === 0 ? (
              <LoadingState />
            ) : paginatedUsers.length === 0 ? (
              <EmptyState label="Nema podataka..." />
            ) : (
              <>
                <View style={styles.remainingContainer}>
                  {paginatedUsers.map((item, i) =>
                    renderRankRow(item, (userPage - 1) * rowsPerPage + i + 1)
                  )}
                </View>
                {data.userRanking.length > rowsPerPage && (
                  <PaginationControls
                    page={userPage}
                    totalPages={totalUserPages}
                    onPrevious={() => setUserPage((p) => p - 1)}
                    onNext={() => setUserPage((p) => p + 1)}
                  />
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'ugostitelj' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.tabHeaderRow}>
              <Text style={localStyles.sectionTitle}>📍 Ikona Gostoprimstva</Text>
            </View>
            {loadingTop && paginatedLocations.length === 0 ? (
              <LoadingState />
            ) : paginatedLocations.length === 0 ? (
              <EmptyState label="Nema podataka..." />
            ) : (
              <>
                <View style={styles.remainingContainer}>
                  {paginatedLocations.map((item, i) =>
                    renderRankRow(item, (locPage - 1) * rowsPerPage + i + 1)
                  )}
                </View>
                {data.locationRanking.length > rowsPerPage && (
                  <PaginationControls
                    page={locPage}
                    totalPages={totalLocPages}
                    onPrevious={() => setLocPage((p) => p - 1)}
                    onNext={() => setLocPage((p) => p + 1)}
                  />
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'total' && (
          <View style={styles.totalOsvezenjeContainer}>
            {loadingTop && combinedRanking.length === 0 ? (
              <LoadingState />
            ) : (
              <>
                <Text style={styles.totalTitle}>🍹 Legende Osveženja</Text>
                {renderTopThree(combinedRanking)}
                {renderRemainingRanks(combinedRanking)}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  dayBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dayBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#8E8E93' },
});

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2196f3' },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textAlign: 'center',
  },
  activeTabText: { color: '#2196f3' },
  tabContentContainer: { padding: 15 },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  statusText: {
    backgroundColor: '#FFF8E1',
    color: '#8A6D1D',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  totalOsvezenjeContainer: { padding: 15 },
  totalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  podiumContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    marginBottom: 15,
    elevation: 3,
  },
  topThreeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumFirst: { marginBottom: 15 },
  avatarContainer: { borderRadius: 100, marginBottom: 8, position: 'relative' },
  avatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 3,
  },
  initialsText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 2,
  },
  rankNumber: { fontSize: 14, fontWeight: '900', color: '#fff' },
  podiumName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
    maxWidth: 95,
  },
  podiumPoints: { fontSize: 12, fontWeight: '600', color: '#4DB6AC' },
  podiumTime: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  remainingContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    elevation: 2,
  },
  remainingRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  remainingLeft: { flexDirection: 'row', alignItems: 'center' },
  smallAvatarContainer: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  smallAvatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
  },
  smallInitialsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  remainingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  remainingRank: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6B6B',
    marginRight: 0,
    width: 40,
  },
  remainingName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  remainingStats: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 1,
  },
});
