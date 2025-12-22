import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const API_URL =
  'https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec';

interface TitleResult {
  title: string;
  winner: string;
}

export default function TitlesScreen() {
  const [titles, setTitles] = useState<TitleResult[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('Global Overall');
  const [loading, setLoading] = useState(true);

  const icons: Record<string, string> = {
    'Most Reliable': '💪',
    'Marathoner': '🏃‍♂️',
    'Early Bird': '🐦',
    'One-Hour Wonder': '⏱️',
    'Ghost': '👻',
  };

  const descriptions: Record<string, string> = {
    'Most Reliable': 'Always shows up. Rain, snow, apocalypse.',
    'Marathoner': 'Stayed so long even the lights wanted to leave.',
    'Early Bird': 'Arrived before the event knew it started.',
    'One-Hour Wonder': 'Fast, efficient, gone before coffee cooled.',
    'Ghost': 'Seen rarely. Proof still under investigation.',
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const res = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);
    const list = await res.json();
    setEvents(['Global Overall', ...list]);
    loadTitles('Global Overall');
  };

  const loadTitles = async (event: string) => {
    setLoading(true);
    const filter = event === 'Global Overall' ? '' : event;
    const res = await fetch(
      `${API_URL}?action=getRankings&event=${encodeURIComponent(filter)}&t=${Date.now()}`
    );
    setTitles(await res.json());
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Titule</Text>
        <Picker
          selectedValue={selectedEvent}
          onValueChange={v => {
            setSelectedEvent(v);
            loadTitles(v);
          }}
          style={styles.picker}
        >
          {events.map((e, i) => (
            <Picker.Item key={i} label={e} value={e} />
          ))}
        </Picker>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : (
        titles.map((t, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.title}>
              {icons[t.title]} {t.title}
            </Text>
            <Text style={styles.desc}>{descriptions[t.title]}</Text>
            <View style={styles.winnerBox}>
              <Text style={styles.winner}>{t.winner}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  picker: { width: 160 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#2196F3' },
  desc: { fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic' },
  winnerBox: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingVertical: 10,
  },
  winner: { textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
