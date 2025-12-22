import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { HistoryItem } from '../../components/api';
import { sharedStyles } from '../../components/styles';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const [userHistory, setUserHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => { if (isFocused) loadInitialData(); }, [isFocused]);

  const loadInitialData = async () => {
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      fetchUserHistory(savedName);
    }
  };

  const fetchUserHistory = async (userName: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getUserData&name=${encodeURIComponent(userName.trim())}&t=${Date.now()}`);
      setUserHistory(await res.json());
    } catch (e) { console.error(e); } finally { setHistoryLoading(false); }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "--:--:--";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--:--:--";
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const calculateTotalTime = (start: string, end: string | null) => {
    if (!end) return "Aktivna Sesija";
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
    <ScrollView contentContainerStyle={sharedStyles.scrollContainer}>
      <View style={sharedStyles.dataBox}>
        <View style={sharedStyles.headerRow}>
          <Text style={sharedStyles.subTitle}>Posete</Text>
            <View style={sharedStyles.chipContainer}>
              <Text style={sharedStyles.chipLabel}>Prikaži:</Text>
              {[5, 10].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setRowsPerPage(value);
                    setCurrentPage(1);
                  }}
                  style={[
                    sharedStyles.chip,
                    rowsPerPage === value && sharedStyles.activeChip
                  ]}
                >
                  <Text style={[
                    sharedStyles.chipText,
                    rowsPerPage === value && sharedStyles.activeChipText
                  ]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
        </View>

        {historyLoading ? <ActivityIndicator size="large" color="#2196F3" /> : (
          currentRows.length > 0 ? currentRows.map((item, i) => (
            <View key={i} style={sharedStyles.historyItemContainer}>
              <View style={sharedStyles.historyTopRow}>
                <Text style={sharedStyles.itemEventText}>📍 {item.event}</Text>
                <Text style={sharedStyles.durationText}>{calculateTotalTime(item.checkin, item.checkout)}</Text>
              </View>
              <View style={sharedStyles.timeDetailsRow}>
                <View style={sharedStyles.timeBlock}>
                  <Text style={sharedStyles.timeLabel}>CHECK-IN</Text>
                  <Text style={sharedStyles.dateText}>{formatDateTime(item.checkin)}</Text>
                </View>
                <View style={sharedStyles.timeBlock}>
                  <Text style={[sharedStyles.timeLabel, {textAlign: 'right'}]}>CHECK-OUT</Text>
                  <Text style={[sharedStyles.dateText, {textAlign: 'right'}]}>{item.checkout ? formatDateTime(item.checkout) : "U toku..."}</Text>
                </View>
              </View>
            </View>
          )) : <Text style={sharedStyles.emptyText}>Nema podataka.</Text>
        )}

        {userHistory.length > rowsPerPage && (
          <View style={sharedStyles.paginationRow}>
            <TouchableOpacity disabled={currentPage === 1} onPress={() => setCurrentPage(p => p - 1)}>
              <Text style={{color: currentPage === 1 ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Prev</Text>
            </TouchableOpacity>
            <Text style={sharedStyles.pageInfo}>Strana {currentPage} od {totalPages}</Text>
            <TouchableOpacity disabled={currentPage === totalPages} onPress={() => setCurrentPage(p => p + 1)}>
              <Text style={{color: currentPage === totalPages ? '#ccc' : '#2196F3', fontWeight: 'bold'}}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}