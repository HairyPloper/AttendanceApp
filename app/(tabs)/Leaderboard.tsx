import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { sharedStyles } from '../../components/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = " ";

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

export default function Leaderboard() {
  const isFocused = useIsFocused();
  const [data, setData] = useState<RankingsData>({ userRanking: [], locationRanking: [] });
  const [eventList, setEventList] = useState<string[]>(["Global Overall"]);
  const [selectedEvent, setSelectedEvent] = useState<string>('Global Overall');
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Pagination for User Table
  const [userPage, setUserPage] = useState(1);
  const rowsPerPage = 5;

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
        setEventList(["Global Overall", ...fresh]);
      }
    } catch (e) { console.warn("Failed to load events"); }
  };

  const fetchRankings = async (eventFilter: string) => {
    setLoading(true);
    try {
      const filter = eventFilter === "Global Overall" ? "" : eventFilter;
      const res = await fetch(`${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`);
      const json = await res.json();
      setData(json);
      setUserPage(1); 
    } catch (e) { 
      console.warn("Ranking fetch failed"); 
    } finally { 
      setLoading(false); 
    }
  };

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * rowsPerPage;
    return data.userRanking.slice(start, start + rowsPerPage);
  }, [data.userRanking, userPage]);

  const totalUserPages = Math.ceil(data.userRanking.length / rowsPerPage) || 1;

  if (!isClient) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* DOMAĆIN MESECA EXPLANATION BOX */}
        {/* <View style={localStyles.domacinCard}>
          <View style={localStyles.cardHeader}>
            <Text style={localStyles.cardIcon}>🏠</Text>
            <Text style={localStyles.cardTitle}>DOMAĆIN MESECA</Text>
          </View>
          <Text style={localStyles.cardDescription}>
            Bodovanje se vrši na osnovu <Text style={{fontWeight: 'bold'}}>sume vaših najdužih dnevnih boravaka</Text>. 
            Gledamo ko provodi najkvalitetnije vreme na lokacijama!
          </Text>
        </View> */}

        {/* 1. LOCATION RANKINGS (Always Global) */}
        <View style={sharedStyles.dataBox}>
          <Text style={localStyles.sectionTitle}>📍 Top Ugostitelj</Text>
          <View style={localStyles.pickerContainer}></View>
          {loading ? (
            <View style={localStyles.loaderContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={localStyles.loaderText}>Učitavanje ugostitelja...</Text>
            </View>
          ) : (
            <>
              {data.locationRanking.length === 0 ? (
                <Text style={sharedStyles.emptyText}>Nema podataka za lokacije.</Text>
              ) : (
                data.locationRanking.map((item, i) => (
                  <View key={i} style={sharedStyles.listItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={[sharedStyles.itemText, i < 3 && { fontWeight: 'bold' }]}>
                        {i === 0 ? "🏆 " : `${i + 1}. `}{item.name}
                      </Text>
                      <Text style={sharedStyles.timeSubtext}>Vreme: {item.timeStr}</Text>
                    </View>
                    <View style={localStyles.dayBadge}>
                      <Text style={localStyles.dayBadgeText}>{item.total}x</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        <View style={{ height: 20 }} />

        {/* 2. USER RANKINGS (Filterable) */}
        <View style={sharedStyles.dataBox}>
          <View style={sharedStyles.headerRow}>
            <Text style={localStyles.sectionTitle}>👑 Top Šmiberi</Text>
            
            <View style={localStyles.pickerContainer}>
              <View style={localStyles.pickerVisual}>
                <Text style={localStyles.pickerText} numberOfLines={1}>{selectedEvent}</Text>
                <Text style={localStyles.pickerIcon}>▼</Text>
              </View>
              <Picker 
                selectedValue={selectedEvent} 
                style={localStyles.pickerHidden}
                onValueChange={(val) => { 
                  setSelectedEvent(val); 
                  fetchRankings(val); 
                }}>
                {eventList.map((evt, idx) => (
                  <Picker.Item key={idx} label={evt} value={evt} />
                ))}
              </Picker>
            </View>
          </View>

          {loading ? (
            <View style={localStyles.loaderContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={localStyles.loaderText}>Osvežavanje šmibera...</Text>
            </View>
          ) : (
            <>
              {paginatedUsers.length === 0 ? (
                <Text style={sharedStyles.emptyText}>Nema podataka za ovaj filter.</Text>
              ) : (
                paginatedUsers.map((item, i) => {
                  const globalIdx = (userPage - 1) * rowsPerPage + i;
                  return (
                    <View key={globalIdx} style={sharedStyles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          sharedStyles.itemText, 
                          { color: globalIdx === 0 ? '#D4AF37' : globalIdx === 1 ? '#8E8E93' : globalIdx === 2 ? '#CD7F32' : '#1C1C1E' },
                          globalIdx < 3 && { fontWeight: 'bold' }
                        ]}>
                          {globalIdx === 0 ? "🥇 " : globalIdx === 1 ? "🥈 " : globalIdx === 2 ? "🥉 " : `${globalIdx + 1}. `}{item.name}
                        </Text>
                        <Text style={sharedStyles.timeSubtext}>Vreme: {item.timeStr}</Text>
                      </View>
                      <Text style={sharedStyles.countText}>{item.total}x</Text>
                    </View>
                  );
                })
              )}

              {/* USER PAGINATION */}
              {data.userRanking.length > rowsPerPage && (
                <View style={sharedStyles.paginationRow}>
                  <TouchableOpacity disabled={userPage === 1} onPress={() => setUserPage(p => p - 1)}>
                    <Text style={[localStyles.pageAction, userPage === 1 && { color: '#C7C7CC' }]}>Nazad</Text>
                  </TouchableOpacity>
                  
                  <View style={localStyles.pageDisplay}>
                    <Text style={sharedStyles.pageInfo}>{userPage} / {totalUserPages}</Text>
                  </View>

                  <TouchableOpacity disabled={userPage === totalUserPages} onPress={() => setUserPage(p => p + 1)}>
                    <Text style={[localStyles.pageAction, userPage === totalUserPages && { color: '#C7C7CC' }]}>Napred</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  domacinCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardIcon: { fontSize: 20, marginRight: 8 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#2E7D32' },
  cardDescription: { fontSize: 12, color: '#3A3A3C', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  
  // New Loader Styles
  loaderContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600'
  },

  dayBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dayBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#8E8E93' },
  pickerContainer: { width: 140, height: 36, position: 'relative', justifyContent: 'center' },
  pickerVisual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F2F2F7', paddingHorizontal: 10, borderRadius: 8, height: '100%' },
  pickerText: { fontSize: 11, fontWeight: '700', color: '#007AFF', flex: 1 },
  pickerIcon: { fontSize: 10, color: '#007AFF', marginLeft: 4 },
  pickerHidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
  pageAction: { fontSize: 14, fontWeight: 'bold', color: '#007AFF', padding: 5 },
  pageDisplay: { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }
});