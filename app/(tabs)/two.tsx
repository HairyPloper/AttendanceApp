import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  
  // Data States
  const [name, setName] = useState('');
  const [leaderboard, setLeaderboard] = useState<{ name: string, total: number }[]>([]);
  const [userHistory, setUserHistory] = useState<{ timestamp: string, event: string }[]>([]);
  const [eventList, setEventList] = useState<string[]>([]);
  
  // Control States
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (isFocused) {
      loadInitialData();
    }
  }, [isFocused]);

  const loadInitialData = async () => {
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      setName(savedName);
      fetchUserHistory(savedName);
    }
    
    try {
      const eventRes = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);
      const events = await eventRes.json();
      // Add a Global option to the list
      const combinedEvents = ["Global Overall", ...events];
      setEventList(combinedEvents);
      
      if (combinedEvents.length > 0) {
        setSelectedEvent(combinedEvents[0]);
        fetchLeaderboard(combinedEvents[0]);
      }
    } catch (e) {
      console.error("Initialization Error:", e);
    }
  };

  const fetchUserHistory = async (userName: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getUserData&name=${encodeURIComponent(userName)}&t=${Date.now()}`);
      setUserHistory(await res.json());
    } catch (e) {
      console.error("History Fetch Error:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLeaderboard = async (eventFilter: string) => {
    setLeaderboardLoading(true);
    try {
      // If "Global Overall" is selected, we send an empty string to the script to trigger global count
      const filter = eventFilter === "Global Overall" ? "" : eventFilter;
      const res = await fetch(`${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`);
      setLeaderboard(await res.json());
    } catch (e) {
      console.error("Leaderboard Fetch Error:", e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  
  // Pad single digits with a leading zero (e.g., 5 becomes 05)
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user_name');
    router.replace('/'); 
    alert("Logged out successfully.");
  };

  // Pagination Logic for History
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = userHistory.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(userHistory.length / rowsPerPage);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      
      {/* 1. PROFILE HEADER */}
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.welcomeText}>Name</Text>
          <Text style={styles.userNameText}>{name}</Text>
        </View>
      <TouchableOpacity 
        style={styles.refreshBtn} 
        onPress={() => {
          fetchUserHistory(name);
          fetchLeaderboard(selectedEvent);
        }}
      >
        <Text style={{color: '#fff', fontWeight: 'bold'}}>Refresh</Text>
      </TouchableOpacity>
      </View>

      {/* 2. HISTORY CARD */}
      <View style={styles.dataBox}>
        <View style={styles.headerRow}>
          <Text style={styles.subTitle}>Your History</Text>
          <View style={styles.pickerContainer}>
            <Picker 
              selectedValue={rowsPerPage} 
              onValueChange={(v) => {setRowsPerPage(Number(v)); setCurrentPage(1);}}
              style={styles.picker}
            >
              <Picker.Item label="10 Rows" value={10} />
              <Picker.Item label="25 Rows" value={25} />
              <Picker.Item label="50 Rows" value={50} />
            </Picker>
          </View>
        </View>

        {historyLoading ? (
          <ActivityIndicator size="large" color="#2196F3" style={{ margin: 20 }} />
        ) : (
          currentRows.length > 0 ? (
            currentRows.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <View>
                  <Text style={styles.itemText}>✅ {item.event}</Text>
                  <Text style={styles.dateText}>{formatDateTime(item.timestamp)}</Text>
                </View>
              </View>
            ))
          ) : <Text style={styles.emptyText}>No scans found.</Text>
        )}

        {userHistory.length > rowsPerPage && (
          <View style={styles.paginationRow}>
            <TouchableOpacity disabled={currentPage === 1} onPress={() => setCurrentPage(p => p - 1)} style={styles.pageBtn}>
              <Text style={{color: currentPage === 1 ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
            <TouchableOpacity disabled={currentPage === totalPages} onPress={() => setCurrentPage(p => p + 1)} style={styles.pageBtn}>
              <Text style={{color: currentPage === totalPages ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. LEADERBOARD CARD */}
      <View style={[styles.dataBox, { marginTop: 20, marginBottom: 40 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.subTitle}>Leaderboard</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedEvent}
              onValueChange={(itemValue) => {
                setSelectedEvent(itemValue);
                fetchLeaderboard(itemValue); // ONLY fetches leaderboard
              }}
              style={styles.picker}
            >
              {eventList.map((evt, index) => (
                <Picker.Item key={index} label={evt} value={evt} />
              ))}
            </Picker>
          </View>
        </View>

        {leaderboardLoading ? (
          <ActivityIndicator size="large" color="#2196F3" style={{ margin: 40 }} />
        ) : (
          leaderboard.length > 0 ? (
            leaderboard.map((item, i) => {
              let itemStyle: any = [styles.itemText];
              let medal = "";
              
              if (i === 0) { 
                medal = "🥇 "; 
                itemStyle = [styles.itemText, { color: '#D4AF37', fontWeight: 'bold' }];
              } else if (i === 1) { 
                medal = "🥈 "; 
                itemStyle = [styles.itemText, { color: '#9E9E9E', fontWeight: 'bold' }];
              } else if (i === 2) { 
                medal = "🥉 "; 
                itemStyle = [styles.itemText, { color: '#CD7F32', fontWeight: 'bold' }];
              } else { 
                medal = `${i + 1}. `; 
              }

              return (
                <View key={i} style={styles.listItem}>
                  <Text style={itemStyle}>{medal}{item.name}</Text>
                  <Text style={styles.countText}>{item.total} Scans</Text>
                </View>
              );
            })
          ) : <Text style={styles.emptyText}>No data available.</Text>
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
  logoutBtn: { padding: 8, backgroundColor: '#fdf2f2', borderRadius: 8 },
  logoutText: { color: '#f44336', fontWeight: 'bold', fontSize: 11 },
  refreshBtn: { backgroundColor: '#2196F3', padding: 15, borderRadius: 12, marginBottom: 15, alignItems: 'center' },
  dataBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  subTitle: { fontWeight: 'bold', fontSize: 18, color: '#333' },
  pickerContainer: { height: 45, width: 150, backgroundColor: '#f9f9f9', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  picker: { height: 45, width: '100%' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9', alignItems: 'center' },
  itemText: { fontSize: 20, color: '#444' },
  countText: { fontWeight: 'bold', color: '#2196F3' },
  dateText: { color: '#aaa', fontSize: 15 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 30 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  pageBtn: { padding: 5 },
  pageInfo: { fontSize: 12, color: '#666' }
});