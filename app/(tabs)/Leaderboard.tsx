import { LeaderboardItem } from '@/components/api';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { getWithExpiry, saveWithExpiry } from '../../components/storageHelper';
import { sharedStyles } from '../../components/styles';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";
const EVENT_CACHE_KEY = "cached_event_list";

export default function Leaderboard() {
  const isFocused = useIsFocused();
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [eventList, setEventList] = useState<string[]>(["Global Overall"]);
  const [selectedEvent, setSelectedEvent] = useState<string>('Global Overall');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isFocused) loadInitialEvents(); }, [isFocused]);

  const loadInitialEvents = async () => {
    try {
      const cachedEvents = await getWithExpiry(EVENT_CACHE_KEY);
      if (cachedEvents) {
        setEventList(JSON.parse(cachedEvents));
      } else {
        const res = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);
        const freshEvents = await res.json();
        const combined = ["Global Overall", ...freshEvents];
        setEventList(combined);
        await saveWithExpiry(EVENT_CACHE_KEY, JSON.stringify(combined), 60);
      }
      fetchLeaderboard(selectedEvent);
    } catch (e) { console.error(e); }
  };

  const fetchLeaderboard = async (eventFilter: string) => {
    setLoading(true);
    try {
      const filter = eventFilter === "Global Overall" ? "" : eventFilter;
      const res = await fetch(`${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}&t=${Date.now()}`);
      setLeaderboard(await res.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={sharedStyles.scrollContainer}>
      <View style={sharedStyles.dataBox}>
        <View style={sharedStyles.headerRow}>
          <Text style={sharedStyles.subTitle}>Rang lista</Text>
          <View style={sharedStyles.modernPickerWrapper}>
            <View style={sharedStyles.visualPickerContainer}>
              <Text style={sharedStyles.pickerIcon}>{"\uf0b0"}</Text>
              <Text style={sharedStyles.pickerText} numberOfLines={1}>{selectedEvent}</Text>
              <Text style={sharedStyles.chevronIcon}>{"\uf0d7"}</Text>
            </View>
            <Picker selectedValue={selectedEvent} style={sharedStyles.invisiblePicker}
              onValueChange={(val) => { setSelectedEvent(val); fetchLeaderboard(val); }}>
              {eventList.map((evt, idx) => <Picker.Item key={idx} label={evt} value={evt} />)}
            </Picker>
          </View>
        </View>

        {loading ? <ActivityIndicator size="large" color="#2196F3" style={{ marginVertical: 20 }} /> : (
          leaderboard.map((item, i) => (
            <View key={i} style={sharedStyles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={[sharedStyles.itemText, { color: i === 0 ? '#D4AF37' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#444', fontWeight: i < 3 ? 'bold' : 'normal' }]}>
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