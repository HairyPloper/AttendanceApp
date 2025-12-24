import { LeaderboardItem } from '@/components/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { getWithExpiry, saveWithExpiry } from '../../components/storageHelper';
import { sharedStyles } from '../../components/styles';

const API_URL = "";
const EVENT_CACHE_KEY = "cached_event_list";
const BOARD_CACHE_PREFIX = "cached_board_";

export default function Leaderboard() {
  const isFocused = useIsFocused();
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [eventList, setEventList] = useState<string[]>(["Global Overall"]);
  const [selectedEvent, setSelectedEvent] = useState<string>('Global Overall');
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (isFocused) {
      // 1. INSTANT FEEDBACK
      setLoading(true);

      // 1s safety delay for the actual fetch
      const timer = setTimeout(() => {
        loadInitialEvents();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  const loadInitialEvents = async () => {
    try {
      // 2. OPTIMISTIC CACHE (Event List)
      const cachedEvents = await getWithExpiry(EVENT_CACHE_KEY);
      if (cachedEvents) {
        setEventList(JSON.parse(cachedEvents));
      }

      // 3. OPTIMISTIC CACHE (Leaderboard Data)
      const cachedBoard = await AsyncStorage.getItem(`${BOARD_CACHE_PREFIX}${selectedEvent}`);
      if (cachedBoard) {
        setLeaderboard(JSON.parse(cachedBoard));
      }

      // Fetch fresh Event List
      const res = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });
      
      if (res.ok) {
        const freshEvents = await res.json();
        const combined = ["Global Overall", ...freshEvents];
        setEventList(combined);
        await saveWithExpiry(EVENT_CACHE_KEY, JSON.stringify(combined), 60);
      }
      
      // Always fetch fresh leaderboard data
      fetchLeaderboard(selectedEvent);
      
    } catch (e) { 
      console.warn("Warmup fetch suppressed"); 
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (eventFilter: string) => {
    setLoading(true);
    try {
      const filter = eventFilter === "Global Overall" ? "" : eventFilter;
      const res = await fetch(`${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });
      
      if (!res.ok) throw new Error();
      
      const data = await res.json();
      setLeaderboard(data);

      // Save to cache for next time
      await AsyncStorage.setItem(`${BOARD_CACHE_PREFIX}${eventFilter}`, JSON.stringify(data));
    } catch (e) { 
      console.warn("Leaderboard fetch failed, using cache"); 
    } finally { 
      setLoading(false); 
    }
  };

  if (!isClient) return null;

  return (
    <ScrollView contentContainerStyle={sharedStyles.scrollContainer}>
      <View style={sharedStyles.dataBox}>
        <View style={sharedStyles.headerRow}>
          <View>
            <Text style={sharedStyles.subTitle}>Rang lista</Text>
          </View>
          
          <View style={sharedStyles.modernPickerWrapper}>
            <View style={sharedStyles.visualPickerContainer}>
              <Text style={sharedStyles.pickerIcon}>{"\uf0b0"}</Text>
              <Text style={sharedStyles.pickerText} numberOfLines={1}>{selectedEvent}</Text>
              <Text style={sharedStyles.chevronIcon}>{"\uf0d7"}</Text>
            </View>
            <Picker 
              selectedValue={selectedEvent} 
              style={sharedStyles.invisiblePicker}
              onValueChange={(val) => { 
                setSelectedEvent(val); 
                fetchLeaderboard(val); 
              }}>
              {eventList.map((evt, idx) => <Picker.Item key={idx} label={evt} value={evt} />)}
            </Picker>
          </View>
        </View>

        {/* TOP SPINNER: Shows while updating if we already have data */}
        {loading && leaderboard.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
            <ActivityIndicator size="small" color="#2196F3" />
          </View>
        )}

        {/* LARGE SPINNER: Shows only on first-ever load */}
        {loading && leaderboard.length === 0 ? (
          <ActivityIndicator size="large" color="#2196F3" style={{ marginVertical: 30 }} />
        ) : (
          leaderboard.map((item, i) => (
            <View key={i} style={sharedStyles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={[
                  sharedStyles.itemText, 
                  { 
                    color: i === 0 ? '#D4AF37' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#444', 
                    fontWeight: i < 3 ? 'bold' : 'normal' 
                  }
                ]}>
                  {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : `${i + 1}. `}{item.name}
                </Text>
                <Text style={sharedStyles.timeSubtext}>Vreme: {item.timeStr}</Text>
              </View>
              <Text style={sharedStyles.countText}>{item.total} posete</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}