import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

interface HistoryItem {
  checkin: string;
  checkout: string | null;
  event: string;
}

interface LeaderboardItem {
  name: string;
  total: number;
  timeStr: string;
}

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const [name, setName] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [userHistory, setUserHistory] = useState<HistoryItem[]>([]);
  const [eventList, setEventList] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { if (isFocused) loadInitialData(); }, [isFocused]);

  const loadInitialData = async () => {
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      setName(savedName);
      fetchUserHistory(savedName);
    }
    try {
      const eventRes = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);
      const events = await eventRes.json();
      const combinedEvents = ["Global Overall", ...events];
      setEventList(combinedEvents);
      if (combinedEvents.length > 0) {
        setSelectedEvent(combinedEvents[0]);
        fetchLeaderboard(combinedEvents[0]);
      }
    } catch (e) { console.error(e); }
  };

  const fetchUserHistory = async (userName: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getUserData&name=${encodeURIComponent(userName.trim())}&t=${Date.now()}`, { method: 'GET', redirect: 'follow' });
      setUserHistory(await res.json());
    } catch (e) { console.error(e); } finally { setHistoryLoading(false); }
  };

  const fetchLeaderboard = async (eventFilter: string) => {
    setLeaderboardLoading(true);
    try {
      const filter = eventFilter === "Global Overall" ? "" : eventFilter;
      const res = await fetch(`${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`, { method: 'GET', redirect: 'follow' });
      setLeaderboard(await res.json());
    } catch (e) { console.error(e); } finally { setLeaderboardLoading(false); }
  };

  // UPDATED: Now shows dd.mm.yyyy hh:mm:ss
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "--:--:--";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--:--:--";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  // UPDATED: Now calculates hh mm ss
  const calculateTotalTime = (start: string, end: string | null) => {
    if (!end) return "Active Session";
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 0) return "0s";
    const totalSeconds = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return (h > 0 ? `${h}h ` : "") + `${m}m ${s}s`;
  };

  const indexOfLastRow = currentPage * rowsPerPage;
  const currentRows = userHistory.slice(indexOfLastRow - rowsPerPage, indexOfLastRow);
  const totalPages = Math.ceil(userHistory.length / rowsPerPage);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.welcomeText}>Attendee</Text>
          <Text style={styles.userNameText}>{name}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { fetchUserHistory(name); fetchLeaderboard(selectedEvent); }}>
          <Text style={{color: '#fff', fontWeight: 'bold'}}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dataBox}>
        <View style={styles.headerRow}>
          <Text style={styles.subTitle}>My Attendance</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={rowsPerPage} onValueChange={(v) => {setRowsPerPage(Number(v)); setCurrentPage(1);}} style={styles.picker}>
              <Picker.Item label="10 Rows" value={10} /><Picker.Item label="25 Rows" value={25} />
            </Picker>
          </View>
        </View>

        {historyLoading ? <ActivityIndicator size="large" color="#2196F3" /> : (
          currentRows.length > 0 ? currentRows.map((item, i) => (
            <View key={i} style={styles.historyItemContainer}>
              <View style={styles.historyTopRow}>
                <Text style={styles.itemEventText}>📍 {item.event}</Text>
                <Text style={styles.durationText}>{calculateTotalTime(item.checkin, item.checkout)}</Text>
              </View>
              <View style={styles.timeDetailsRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK-IN</Text>
                  <Text style={styles.dateText}>{formatDateTime(item.checkin)}</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={[styles.timeLabel, {textAlign: 'right'}]}>CHECK-OUT</Text>
                  <Text style={[styles.dateText, {textAlign: 'right'}]}>{item.checkout ? formatDateTime(item.checkout) : "Pending..."}</Text>
                </View>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No scans found.</Text>
        )}

        {userHistory.length > rowsPerPage && (
          <View style={styles.paginationRow}>
            <TouchableOpacity disabled={currentPage === 1} onPress={() => setCurrentPage(p => p - 1)}>
              <Text style={{color: currentPage === 1 ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
            <TouchableOpacity disabled={currentPage === totalPages} onPress={() => setCurrentPage(p => p + 1)}>
              <Text style={{color: currentPage === totalPages ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.dataBox, { marginTop: 20, marginBottom: 40 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.subTitle}>Leaderboard</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedEvent} onValueChange={(val) => { setSelectedEvent(val); fetchLeaderboard(val); }} style={styles.picker}>
              {eventList.map((evt, idx) => <Picker.Item key={idx} label={evt} value={evt} />)}
            </Picker>
          </View>
        </View>
        {leaderboardLoading ? <ActivityIndicator size="large" color="#2196F3" /> : (
          leaderboard.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemText, { color: i === 0 ? '#D4AF37' : '#444', fontWeight: i < 3 ? 'bold' : 'normal' }]}>
                  {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : `${i + 1}. `}{item.name}
                </Text>
                <Text style={styles.timeSubtext}>Total Time: {item.timeStr}</Text>
              </View>
              <Text style={styles.countText}>{item.total} Days</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { padding: 15 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
  welcomeText: { fontSize: 12, color: '#888' },
  userNameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  refreshBtn: { backgroundColor: '#2196F3', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  dataBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  subTitle: { fontWeight: 'bold', fontSize: 18, color: '#333' },
  pickerContainer: { height: 45, width: 140, backgroundColor: '#f9f9f9', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  picker: { height: 45, width: '100%' },
  historyItemContainer: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  historyTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemEventText: { fontSize: 16, fontWeight: '600', color: '#444' },
  durationText: { color: '#2196F3', fontWeight: 'bold' },
  timeDetailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 10, color: '#999', marginBottom: 2 },
  dateText: { color: '#555', fontSize: 12, fontWeight: '500' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9', alignItems: 'center' },
  itemText: { fontSize: 16 },
  timeSubtext: { fontSize: 11, color: '#888', marginLeft: 26 },
  countText: { fontWeight: 'bold', color: '#2196F3', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 30 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  pageInfo: { fontSize: 12, color: '#666' }
});