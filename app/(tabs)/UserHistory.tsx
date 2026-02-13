import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSecurityCredentials } from '../../components/securityHelper';
import { getWithExpiry, saveWithExpiry } from '../../components/storageHelper';
import { sharedStyles } from '../../components/styles';

const API_URL = 'api_url_go';
const EVENT_CACHE_KEY = 'cached_event_list';

const VISIT_MILESTONES = [
  { limit: 1, label: 'Srednjoškolac', img: 'visits_1', sub: 'Ide u srednju školu.' },
  { limit: 5, label: 'Gaijin', img: 'visits_5', sub: 'Još uvek stranac.' },
  { limit: 10, label: 'Street Racer', img: 'visits_10', sub: 'Dobro poznaje miris afalta.' },
  { limit: 25, label: 'Challenger', img: 'visits_25', sub: 'Ulice ga poznaju.' },
  { limit: 50, label: 'Han', img: 'visits_50', sub: 'Ima svoju garažu.' },
  { limit: 100, label: 'D.K. (Legend)', img: 'visits_100', sub: 'Gospodar planine.' },
];

const TIME_MILESTONES = [
  { limit: 1, label: 'Prijatelj', img: 'time_1', sub: 'Zna gde je WC.' },
  { limit: 25, label: 'Odomaćio se', img: 'time_25', sub: 'Zove te cimerom.' },
  { limit: 50, label: 'Inventar', img: 'time_50', sub: 'Zna gde se sedi.' },
  { limit: 100, label: 'Drugi dom', img: 'time_100', sub: 'Ključ mu još fali.' },
  { limit: 200, label: 'Živi ovde', img: 'time_200', sub: 'Ako nestane - zovite policiju.' },
  { limit: 400, label: 'Gazda', img: 'time_400', sub: 'Plaća porez na imovinu.' },
];

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const isMounted = useRef(true);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [eventList, setEventList] = useState<string[]>(['Ukupno']);
  const [selectedEvent, setSelectedEvent] = useState<string>('Ukupno');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isClient, setIsClient] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'visits' | 'time'>('visits');

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const openNote = (note: string) => {
    if (!note || note.trim() === '') return;
    setSelectedNote(note);
    setNoteModalVisible(true);
  };

  useEffect(() => {
    isMounted.current = true;
    setIsClient(true);
    if (isFocused) {
      loadInitialData();
    }
    return () => {
      isMounted.current = false;
    };
  }, [isFocused]);

  const getMilestone = (val: number, milestones: any[]) => {
    let current = milestones[0];
    let next = milestones[1] || milestones[0];
    for (let i = 0; i < milestones.length; i++) {
      if (val >= milestones[i].limit) {
        current = milestones[i];
        next = milestones[i + 1] || milestones[i];
      }
    }
    const progress = Math.min(val / next.limit, 1);
    return { current, next, progress };
  };

  const stats = useMemo(() => {
    const filtered =
      selectedEvent === 'Ukupno'
        ? userHistory
        : userHistory.filter((item) => item.event === selectedEvent);

    const totalVisits = filtered.length;
    let totalMs = 0;
    filtered.forEach((item) => {
      if (item.checkin && item.checkout) {
        totalMs += new Date(item.checkout).getTime() - new Date(item.checkin).getTime();
      }
    });
    const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    return { totalVisits, totalHours };
  }, [userHistory, selectedEvent]);

  const loadInitialData = async () => {
    try {
      const { name: savedName, secret } = await getSecurityCredentials();

      // If there is no name yet, we can't do anything
      if (!savedName || savedName === 'Gost') {
        setHistoryLoading(false);
        return;
      }

      const [cachedHistStr, cachedEvents] = await Promise.all([
        AsyncStorage.getItem(`cache_history_${savedName}`),
        getWithExpiry(EVENT_CACHE_KEY),
      ]);

      let hasHistory = false;
      let hasEvents = false;

      if (isMounted.current && cachedHistStr) {
        setUserHistory(JSON.parse(cachedHistStr));
        hasHistory = true;
      }

      if (isMounted.current && cachedEvents) {
        const parsedEvents =
          typeof cachedEvents === 'string' ? JSON.parse(cachedEvents) : cachedEvents;
        setEventList(parsedEvents);
        hasEvents = true;
      }

      if (!hasHistory || !hasEvents) {
        fetchFreshData(savedName, secret);
      } else {
        setHistoryLoading(false);
        fetchFreshData(savedName, secret);
      }
    } catch (e) {
      console.log('Initial load error:', e);
      setHistoryLoading(false);
    }
  };

  const fetchFreshData = async (name: string, secret: string) => {
    if (!isMounted.current) return;
    setHistoryLoading(true);

    try {
      const evRes = await fetch(`${API_URL}?action=getEventList&t=${Date.now()}`);

      if (evRes.ok) {
        const freshEvents = await evRes.json();
        // Safety check to ensure we got an array, not an error object
        if (Array.isArray(freshEvents)) {
          const combined = ['Ukupno', ...freshEvents];
          if (isMounted.current) {
            setEventList(combined);
            await saveWithExpiry(EVENT_CACHE_KEY, JSON.stringify(combined), 60);
          }
        }
      }

      const histRes = await fetch(
        `${API_URL}?action=getUserData&name=${encodeURIComponent(name.trim())}&secret=${secret}&t=${Date.now()}`
      );

      const data = await histRes.json();
      if (data.error) {
        console.warn('Server Error:', data.error);
        if (isMounted.current) setUserHistory([]);
        return;
      }

      const validatedData = Array.isArray(data) ? data : [];

      if (isMounted.current) {
        setUserHistory(validatedData);
        await AsyncStorage.setItem(`cache_history_${name}`, JSON.stringify(validatedData));
      }
    } catch (e) {
      console.log('Network Fetch Error:', e);
    } finally {
      if (isMounted.current) setHistoryLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '--:--:--';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--:--:--';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const calculateTotalTime = (start: string, end: string | null) => {
    if (!end) return 'Aktivna Sesija';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 0) return '0s';
    const totalSeconds = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return (h > 0 ? `${h}h ` : '') + `${m}m ${s}s`;
  };

  const getMilestoneImage = (imgKey: string) => {
    switch (imgKey) {
      case 'visits_1':
        return require('../../assets/images/visits_1-min.png');
      case 'visits_5':
        return require('../../assets/images/visits_5-min.png');
      case 'visits_10':
        return require('../../assets/images/visits_10-min.png');
      case 'visits_25':
        return require('../../assets/images/visits_25-min.png');
      case 'visits_50':
        return require('../../assets/images/visits_50-min.png');
      case 'visits_100':
        return require('../../assets/images/visits_100-min.png');
      case 'time_1':
        return require('../../assets/images/time_1-min.png');
      case 'time_25':
        return require('../../assets/images/time_25-min.png');
      case 'time_50':
        return require('../../assets/images/time_50-min.png');
      case 'time_100':
        return require('../../assets/images/time_100-min.png');
      case 'time_200':
        return require('../../assets/images/time_200-min.png');
      case 'time_400':
        return require('../../assets/images/time_400-min.png');
      default:
        return require('../../assets/images/visits_1-min.png');
    }
  };

  const AchievementCard = ({ data, currentVal, unit }: any) => (
    <View style={localStyles.achCard}>
      <View style={localStyles.achHeader}>
        <Image
          source={getMilestoneImage(data.current.img)}
          style={localStyles.duoImage}
          resizeMode="contain"
        />
      </View>
      <View style={localStyles.textContainer}>
        <Text style={localStyles.achTitle}>{data.current.label}</Text>
      </View>
      <Text style={localStyles.achSubtext}>{data.current.sub}</Text>
      <View style={localStyles.progressContainer}>
        <View style={localStyles.progressBg}>
          <View style={{ ...localStyles.progressFill, width: `${data.progress * 100}%` }}>
            <View style={localStyles.progressShine} />
          </View>
        </View>
        <Text style={localStyles.progressText}>
          {currentVal}/{data.next.limit} {unit}
        </Text>
      </View>
    </View>
  );

  const MilestoneModal = () => {
    const milestones = modalType === 'visits' ? VISIT_MILESTONES : TIME_MILESTONES;
    const currentVal = modalType === 'visits' ? stats.totalVisits : stats.totalHours;
    const unit = modalType === 'visits' ? 'pos' : 'h';

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>
                {modalType === 'visits' ? 'Put do Drift Kinga' : 'Nivo Cimera'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={localStyles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {milestones.map((m, index) => {
                const isUnlocked = currentVal >= m.limit;
                return (
                  <View key={index} style={localStyles.milestoneRow}>
                    <Image
                      source={getMilestoneImage(m.img)}
                      style={[localStyles.modalRowImage, !isUnlocked && { opacity: 0.25 }]}
                      resizeMode="contain"
                    />
                    <View style={localStyles.modalRowInfo}>
                      <Text style={[localStyles.modalRowLabel, !isUnlocked && { color: '#888' }]}>
                        {m.label} {isUnlocked ? '✅' : `(${m.limit}${unit})`}
                      </Text>
                      <Text style={[localStyles.modalRowSub, !isUnlocked && { color: '#aaa' }]}>
                        {m.sub}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (!isClient) return null;
  const indexOfLastRow = currentPage * rowsPerPage;
  const currentRows = userHistory.slice(indexOfLastRow - rowsPerPage, indexOfLastRow);
  const totalPages = Math.ceil(userHistory.length / rowsPerPage) || 1;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContainer}>
        <View style={[sharedStyles.dataBox, { marginBottom: 12 }]}>
          <View style={sharedStyles.headerRow}>
            <Text style={sharedStyles.subTitle}>Nivo</Text>
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
                onValueChange={(val) => setSelectedEvent(val)}
              >
                {eventList.map((evt, idx) => (
                  <Picker.Item key={idx} label={evt} value={evt} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={localStyles.achievementRow}>
            <TouchableOpacity
              style={{ width: '48.5%' }}
              onPress={() => {
                setModalType('visits');
                setModalVisible(true);
              }}
            >
              <AchievementCard
                data={getMilestone(stats.totalVisits, VISIT_MILESTONES)}
                currentVal={stats.totalVisits}
                unit="pos"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: '48.5%' }}
              onPress={() => {
                setModalType('time');
                setModalVisible(true);
              }}
            >
              <AchievementCard
                data={getMilestone(stats.totalHours, TIME_MILESTONES)}
                currentVal={stats.totalHours}
                unit="h"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={sharedStyles.dataBox}>
          <View style={sharedStyles.headerRow}>
            <Text style={sharedStyles.subTitle}>Istorija Poseta</Text>
            {historyLoading && <ActivityIndicator size="small" color="#2196F3" />}
          </View>
          {userHistory.length === 0 && !historyLoading ? (
            <Text style={sharedStyles.emptyText}>Još uvek nemaš zabeleženih poseta.</Text>
          ) : (
            currentRows.map((item, i) => (
              <TouchableOpacity
                key={item.id || i}
                onPress={() => openNote(item.note)}
                activeOpacity={item.note ? 0.7 : 1}
                style={sharedStyles.historyItemContainer}
              >
                <View style={sharedStyles.historyTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={sharedStyles.itemEventText}>📍 {item.event}</Text>
                  </View>
                  <Text style={sharedStyles.durationText}>
                    {calculateTotalTime(item.checkin, item.checkout)}
                  </Text>
                </View>

                {item.note ? (
                  <View style={localStyles.stickyNotePreview}>
                    <Text style={localStyles.stickyNotePreviewText} numberOfLines={1}>
                      {item.note}
                    </Text>
                  </View>
                ) : null}

                <View style={sharedStyles.timeDetailsRow}>
                  <View style={sharedStyles.timeBlock}>
                    <Text style={sharedStyles.timeLabel}>ULAZ</Text>
                    <Text style={sharedStyles.dateText}>{formatDateTime(item.checkin)}</Text>
                  </View>
                  <View style={sharedStyles.timeBlock}>
                    <Text style={[sharedStyles.timeLabel, { textAlign: 'right' }]}>IZLAZ</Text>
                    <Text style={[sharedStyles.dateText, { textAlign: 'right' }]}>
                      {item.checkout ? formatDateTime(item.checkout) : 'U toku...'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          {userHistory.length > rowsPerPage && (
            <View style={sharedStyles.paginationRow}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((p) => p - 1)}
              >
                <Text style={{ color: currentPage === 1 ? '#ccc' : '#2196F3', fontWeight: 'bold' }}>
                  Nazad
                </Text>
              </TouchableOpacity>
              <Text style={sharedStyles.pageInfo}>
                {currentPage} / {totalPages}
              </Text>
              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage((p) => p + 1)}
              >
                <Text
                  style={{
                    color: currentPage === totalPages ? '#ccc' : '#2196F3',
                    fontWeight: 'bold',
                  }}
                >
                  Napred
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Modal
            visible={noteModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setNoteModalVisible(false)}
          >
            <View style={localStyles.modalOverlay}>
              <View style={[localStyles.modalContent, localStyles.stickyNoteMain]}>
                <View style={localStyles.stickyNoteTape} />

                <Text style={localStyles.stickyNoteTitle}>Beleška</Text>

                <ScrollView style={localStyles.stickyNoteScroll}>
                  <Text style={localStyles.stickyNoteFullText}>{selectedNote}</Text>
                </ScrollView>

                <TouchableOpacity
                  style={localStyles.stickyCloseBtn}
                  onPress={() => setNoteModalVisible(false)}
                >
                  <Text style={localStyles.stickyCloseText}>Zatvori</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {toast && (
            <View style={[localStyles.toast, localStyles[toast.type]]}>
              <Text style={localStyles.toastText}>{toast.message}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <MilestoneModal />
    </View>
  );
}

const localStyles = StyleSheet.create({
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  achCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 5,
    elevation: 3, // Use elevation for Android
    shadowColor: '#000', // Proper iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    justifyContent: 'space-between',
    minHeight: 160,
  },
  achHeader: { alignItems: 'center', marginBottom: 8 },
  duoImage: { width: 100, height: 100 },
  textContainer: { alignItems: 'center', marginBottom: 4 },
  achTitle: { fontSize: 13, fontWeight: '900', color: '#4B4B4B', textTransform: 'uppercase' },
  achSubtext: {
    fontSize: 10,
    color: '#777',
    lineHeight: 13,
    marginBottom: 8,
    minHeight: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressContainer: { marginTop: 'auto' },
  progressBg: { height: 12, backgroundColor: '#E5E5E5', borderRadius: 10, overflow: 'hidden' },
  progressFill: {
    height: '100%',
    backgroundColor: '#58CC02',
    borderRadius: 10,
    justifyContent: 'center',
  },
  progressShine: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    width: '90%',
    alignSelf: 'center',
    marginTop: -4,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'center',
    color: '#AFAFAF',
    fontWeight: '900',
    marginTop: 5,
    textTransform: 'uppercase',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#333', textTransform: 'uppercase' },
  closeButton: { fontSize: 24, color: '#999', fontWeight: 'bold' },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalRowImage: { width: 60, height: 60, marginRight: 15 },
  modalRowInfo: { flex: 1 },
  modalRowLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  modalRowSub: { fontSize: 12, color: '#666' },
  notePreviewBox: { marginTop: 4, paddingLeft: 22 },
  notePreviewText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  noteViewArea: { backgroundColor: '#F9F9F9', borderRadius: 15, padding: 15, marginBottom: 20 },
  fullNoteText: { fontSize: 16, color: '#444', lineHeight: 22 },
  closeModalBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 15,
    elevation: 10,
    zIndex: 100,
  },
  success: { backgroundColor: '#4CAF50' },
  error: { backgroundColor: '#F44336' },
  info: { backgroundColor: '#2196F3' },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 15 },
  stickyNotePreview: {
    backgroundColor: '#FFF9C4',
    marginTop: 8,
    marginLeft: 22,
    padding: 8,
    borderRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
    elevation: 2,
  },
  stickyNotePreviewText: {
    fontSize: 12,
    color: '#5D4037',
    fontWeight: '500',
  },
  stickyNoteMain: {
    backgroundColor: '#FFF59D', // Classic sticky note yellow
    borderRadius: 2,
    padding: 25,
    paddingTop: 35,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  stickyNoteTape: {
    width: 100,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Semi-transparent tape
    position: 'absolute',
    top: -15,
    alignSelf: 'center',
    transform: [{ rotate: '-2deg' }],
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  stickyNoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#795548',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'sans-serif-condensed',
  },
  stickyNoteScroll: {
    maxHeight: 250,
  },
  stickyNoteFullText: {
    fontSize: 16,
    color: '#3E2723',
    lineHeight: 22,
    fontFamily: 'sans-serif-medium',
  },
  stickyCloseBtn: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stickyCloseText: {
    color: '#5D4037',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
