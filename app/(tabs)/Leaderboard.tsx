import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { sharedStyles } from '../../components/styles';

const API_URL = 'api_url_go';

const HOST_LOCATION_MAP: { user: string; location: string }[] = [
  { user: 'Pako', location: 'PAKISTAN' },
  { user: 'Makaron', location: 'MAKISTAN' },
  { user: 'Miky', location: 'MYKYSTAN' },
  { user: 'Shomi', location: 'SOMISTAN' },
  { user: 'Toške', location: 'TOSESTAN' },
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

// Generate initials-based avatar
// Or get icon if exists in map PROFILE_ICON_MAP
const getInitials = (name: string): string => {
  const mapping = PROFILE_ICON_MAP.find((m) => m.user.toLowerCase() === name.toLowerCase());
  if (mapping != null) {
    return mapping.icon;
  }

  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Generate color based on name
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

interface RankingItem {
  name: string;
  total: number;
  totalMs: number;
  timeStr: string;
}

interface RankingsData {
  userRanking: RankingItem[];
  locationRanking: RankingItem[];
}

function msToTimeStr(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function Leaderboard() {
  const isFocused = useIsFocused();
  const [data, setData] = useState<RankingsData>({ userRanking: [], locationRanking: [] });
  const [eventList, setEventList] = useState<string[]>(['Ukupno']);
  const [selectedEvent, setSelectedEvent] = useState<string>('Ukupno');
  const [loadingTop, setLoadingTop] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'smiberi' | 'ugostitelj' | 'total'>('smiberi');

  // We keep an unfiltered snapshot of the leaderboard data to build the "Ukupno Osveženje" ranking.
  const allTimeData = useRef<RankingsData>({ userRanking: [], locationRanking: [] });

  // Pagination for User Table
  const [userPage, setUserPage] = useState(1);
  const rowsPerPage = 7;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * rowsPerPage;
    return data.userRanking.slice(start, start + rowsPerPage);
  }, [data.userRanking, userPage]);
  const totalUserPages = Math.ceil(data.userRanking.length / rowsPerPage) || 1;

  // Pagination for Location Table
  const [locPage, setLocPage] = useState(1);
  const rowsPerPageLoc = 7;
  const paginatedLocations = data.locationRanking.slice(
    (locPage - 1) * rowsPerPageLoc,
    locPage * rowsPerPageLoc
  );
  const totalLocPages = Math.ceil(data.locationRanking.length / rowsPerPageLoc);

  const [combinedRanking, setCombinedRanking] = useState<
    { name: string; location: string | null; total: number; totalMs: number; timeStr: string }[]
  >([]);

  const buildCombinedRanking = () => {
    const snapshot = allTimeData.current;
    const result = snapshot.userRanking.map((userEntry) => {
      const mapping = HOST_LOCATION_MAP.find(
        (m) => m.user.toLowerCase() === userEntry.name.toLowerCase()
      );
      const locEntry = mapping
        ? snapshot.locationRanking.find(
            (r) => r.name.toLowerCase() === mapping.location.toLowerCase()
          )
        : undefined;

      const totalMs = userEntry.totalMs + (locEntry?.totalMs ?? 0);
      const total = userEntry.total + (locEntry?.total ?? 0);

      return {
        name: userEntry.name,
        location: mapping?.location ?? null,
        total,
        totalMs,
        timeStr: locEntry ? msToTimeStr(totalMs) : userEntry.timeStr,
      };
    });
    result.sort((a, b) => b.totalMs - a.totalMs);
    setCombinedRanking(result);
  };

  useEffect(() => {
    setIsClient(true);
    if (isFocused) {
      loadEventList();
      fetchRankings(selectedEvent);
    }
  }, [isFocused]);

  const loadEventList = async () => {
    try {
      const res = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);
      if (res.ok) {
        const fresh = await res.json();
        setEventList(['Ukupno', ...fresh]);
      }
    } catch (e) {
      console.warn('Failed to load events');
    }
  };

  const fetchRankings = async (eventFilter: string) => {
    setLoadingTop(true);
    try {
      const filter = eventFilter === 'Ukupno' ? '' : eventFilter;
      const res = await fetch(
        `${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`
      );
      const json = await res.json();

      if (json.error) {
        console.error('Leaderboard Error:', json.error);
        setData({ userRanking: [], locationRanking: [] });
        return;
      }

      setData(json);
      setUserPage(1);

      if (!filter && allTimeData.current.userRanking.length === 0) {
        allTimeData.current = json;
        buildCombinedRanking();
      }
    } catch (e) {
      console.warn('Ranking fetch failed');
    } finally {
      setLoadingTop(false);
    }
  };

  if (!isClient) return null;

  // Render circular profile design for Total Osveženje tab
  const renderTopThree = (rankings: any[]) => {
    if (rankings.length === 0) return <Text style={styles.emptyText}>Nema podataka...</Text>;

    const topThree = rankings.slice(0, 3);
    const positions = [1, 0, 2]; // Order: 2nd, 1st, 3rd for visual layout

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
              <View key={index} style={[styles.podiumItem, rank === 1 && styles.podiumFirst]}>
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

  const renderRemainingRanks = (rankings: any[]) => {
    if (rankings.length <= 3) return null;

    const remaining = rankings.slice(3, 10); // Show positions 4-9

    return (
      <View style={styles.remainingContainer}>
        {remaining.map((person, index) => {
          const rank = index + 4;
          const initials = getInitials(person.name);
          const bgColor = getAvatarColor(person.name);

          return (
            <View key={index} style={styles.remainingRow}>
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      {/* Tab Navigation */}
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
            🍹Osveženje
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={sharedStyles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* TAB 1: TOP ŠMIBERI */}
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
                  onValueChange={(val) => {
                    setSelectedEvent(val);
                    fetchRankings(val);
                  }}
                >
                  {eventList.map((evt, idx) => (
                    <Picker.Item key={idx} label={evt} value={evt} />
                  ))}
                </Picker>
              </View>
            </View>

            {loadingTop ? (
              <View style={localStyles.loaderContainer}>
                <ActivityIndicator size="large" color="#2196f3" />
                <Text style={styles.loaderTextBlue}>Učitavanje...</Text>
              </View>
            ) : (
              <>
                {paginatedUsers.length === 0 ? (
                  <Text style={styles.emptyText}>Nema podataka...</Text>
                ) : (
                  <View style={styles.remainingContainer}>
                    {paginatedUsers.map((item, i) => {
                      const globalIdx = (userPage - 1) * rowsPerPage + i;
                      return (
                        <View key={globalIdx} style={styles.remainingRow}>
                          <View style={styles.remainingLeft}>
                            <Text style={styles.remainingRank}>
                              {globalIdx === 0
                                ? '🥇'
                                : globalIdx === 1
                                  ? '🥈'
                                  : globalIdx === 2
                                    ? '🥉'
                                    : `${globalIdx + 1}.`}
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
                    })}
                  </View>
                )}

                {data.userRanking.length > rowsPerPage && (
                  <View style={sharedStyles.paginationRow}>
                    <TouchableOpacity
                      disabled={userPage === 1}
                      onPress={() => setUserPage((p) => p - 1)}
                    >
                      <Text
                        style={[localStyles.pageAction, userPage === 1 && { color: '#C7C7CC' }]}
                      >
                        Nazad
                      </Text>
                    </TouchableOpacity>

                    <View style={localStyles.pageDisplay}>
                      <Text style={sharedStyles.pageInfo}>
                        {userPage} / {totalUserPages}
                      </Text>
                    </View>

                    <TouchableOpacity
                      disabled={userPage === totalUserPages}
                      onPress={() => setUserPage((p) => p + 1)}
                    >
                      <Text
                        style={[
                          localStyles.pageAction,
                          userPage === totalUserPages && { color: '#C7C7CC' },
                        ]}
                      >
                        Napred
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 2: TOP UGOSTITELJ */}
        {activeTab === 'ugostitelj' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.tabHeaderRow}>
              <Text style={localStyles.sectionTitle}>📍 Ikona Gostoprimstva</Text>
            </View>
            {paginatedLocations.length === 0 ? (
              <View style={localStyles.loaderContainer}>
                <ActivityIndicator size="large" color="#2196f3" />
                <Text style={styles.loaderTextBlue}>Učitavanje...</Text>
              </View>
            ) : (
              <>
                <View style={styles.remainingContainer}>
                  {paginatedLocations.map((item, i) => {
                    const locGlobalIdx = (locPage - 1) * rowsPerPageLoc + i;
                    return (
                      <View key={locGlobalIdx} style={styles.remainingRow}>
                        <View style={styles.remainingLeft}>
                          <Text style={styles.remainingRank}>
                            {locGlobalIdx === 0 ? '🏆' : `${locGlobalIdx + 1}.`}
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
                  })}
                </View>

                {data.locationRanking.length > rowsPerPageLoc && (
                  <View style={sharedStyles.paginationRow}>
                    <TouchableOpacity
                      disabled={locPage === 1}
                      onPress={() => setLocPage((p) => p - 1)}
                    >
                      <Text style={[localStyles.pageAction, locPage === 1 && { color: '#C7C7CC' }]}>
                        Nazad
                      </Text>
                    </TouchableOpacity>

                    <View style={localStyles.pageDisplay}>
                      <Text style={sharedStyles.pageInfo}>
                        {locPage} / {totalLocPages}
                      </Text>
                    </View>

                    <TouchableOpacity
                      disabled={locPage === totalLocPages}
                      onPress={() => setLocPage((p) => p + 1)}
                    >
                      <Text
                        style={[
                          localStyles.pageAction,
                          locPage === totalLocPages && { color: '#C7C7CC' },
                        ]}
                      >
                        Napred
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: TOTAL OSVEŽENJE - NEW CIRCULAR DESIGN */}
        {activeTab === 'total' && (
          <View style={styles.totalOsvezenjeContainer}>
            {combinedRanking.length === 0 ? (
              <View style={localStyles.loaderContainer}>
                <ActivityIndicator size="large" color="#4DB6AC" />
                <Text style={styles.loaderTextBlue}>Učitavanje...</Text>
              </View>
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
  loaderContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  dayBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dayBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#8E8E93' },
  pageAction: { fontSize: 14, fontWeight: 'bold', color: '#007AFF', padding: 5 },
  pageDisplay: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
});

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196f3',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#2196f3',
    fontWeight: '700',
  },
  tabContentContainer: {
    padding: 15,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalOsvezenjeContainer: {
    padding: 15,
  },
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
    borderRadius: 20,
    padding: 5,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topThreeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  podiumFirst: {
    marginBottom: 15,
  },
  avatarContainer: {
    borderRadius: 100,
    marginBottom: 8,
    position: 'relative',
  },
  avatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  initialsText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
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
  rankNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  podiumName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  podiumPoints: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4DB6AC',
  },
  podiumTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  remainingContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  remainingRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  remainingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  smallAvatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  smallInitialsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  remainingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  remainingRank: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6B6B',
    marginRight: 0,
    width: 40,
  },
  remainingName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  remainingStats: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 1,
  },
  loaderTextBlue: {
    marginTop: 15,
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    paddingVertical: 30,
  },
});
