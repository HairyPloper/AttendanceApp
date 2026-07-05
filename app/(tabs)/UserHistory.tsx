import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getEventList, getUserData, HistoryItem } from '../../components/api';
import {
  calculateTotalTime,
  formatDateTime,
  getMilestone,
  Milestone,
  MilestoneProgress,
} from '../../components/attendanceUtils';
import { getSecurityCredentials } from '../../components/securityHelper';
import { CACHE_KEYS, getWithExpiry, saveWithExpiry } from '../../components/storageHelper';
import { sharedStyles } from '../../components/styles';
import {
  EmptyState,
  LoadingState,
  PaginationControls,
  ToastMessage,
  ToastType,
} from '../../components/ui';

const VISIT_MILESTONES: Milestone[] = [
  { limit: 1, label: 'Srednjoškolac', img: 'visits_1', sub: 'Ide u srednju školu.' },
  { limit: 5, label: 'Gaijin', img: 'visits_5', sub: 'Još uvek stranac.' },
  { limit: 10, label: 'Street Racer', img: 'visits_10', sub: 'Dobro poznaje miris asfalta.' },
  { limit: 25, label: 'Challenger', img: 'visits_25', sub: 'Ulice ga poznaju.' },
  { limit: 50, label: 'Han', img: 'visits_50', sub: 'Ima svoju garažu.' },
  { limit: 100, label: 'D.K. (Legend)', img: 'visits_100', sub: 'Gospodar planine.' },
];

const TIME_MILESTONES: Milestone[] = [
  { limit: 1, label: 'Prijatelj', img: 'time_1', sub: 'Zna gde je WC.' },
  { limit: 25, label: 'Odomaćio se', img: 'time_25', sub: 'Zove te cimerom.' },
  { limit: 50, label: 'Inventar', img: 'time_50', sub: 'Zna gde se sedi.' },
  { limit: 100, label: 'Drugi dom', img: 'time_100', sub: 'Ključ mu još fali.' },
  { limit: 200, label: 'Živi ovde', img: 'time_200', sub: 'Ako nestane - zovite policiju.' },
  { limit: 400, label: 'Gazda', img: 'time_400', sub: 'Plaća porez na imovinu.' },
];

const rowsPerPage = 5;

function getMilestoneImage(imgKey: string) {
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
}

export default function HistoryScreen() {
  const isFocused = useIsFocused();
  const isMounted = useRef(true);
  const [userName, setUserName] = useState<string>('');
  const [userHistory, setUserHistory] = useState<HistoryItem[]>([]);
  const [eventList, setEventList] = useState<string[]>(['Ukupno']);
  const [selectedEvent, setSelectedEvent] = useState<string>('Ukupno');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isClient, setIsClient] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'visits' | 'time'>('visits');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEvent]);

  const filteredHistory = useMemo(() => {
    return selectedEvent === 'Ukupno'
      ? userHistory
      : userHistory.filter((item) => item.event === selectedEvent);
  }, [selectedEvent, userHistory]);

  const stats = useMemo(() => {
    const totalVisits = filteredHistory.length;
    let totalMs = 0;
    filteredHistory.forEach((item) => {
      if (item.checkin && item.checkout) {
        totalMs += new Date(item.checkout).getTime() - new Date(item.checkin).getTime();
      }
    });
    const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    return { totalVisits, totalHours };
  }, [filteredHistory]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const currentRows = filteredHistory.slice(indexOfLastRow - rowsPerPage, indexOfLastRow);
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage) || 1;

  const openNote = (note?: string | null) => {
    if (!note || note.trim() === '') return;
    setSelectedNote(note);
    setNoteModalVisible(true);
  };

  const loadInitialData = async () => {
    try {
      const { name: savedName, secret } = await getSecurityCredentials();
      setUserName(savedName);

      if (!savedName || savedName === 'Gost') {
        setHistoryLoading(false);
        setStatusText('Sačuvaj ime na ekranu za skeniranje da bi video istoriju.');
        return;
      }

      const [cachedHistory, cachedEvents] = await Promise.all([
        getWithExpiry<HistoryItem[]>(CACHE_KEYS.history(savedName)),
        getWithExpiry<string[]>(CACHE_KEYS.eventList),
      ]);

      if (isMounted.current && cachedHistory) {
        setUserHistory(cachedHistory);
        setStatusText('Prikazujem keširanu istoriju dok osvežavam.');
      }

      if (isMounted.current && cachedEvents) {
        setEventList(cachedEvents);
      }

      if (!cachedHistory) setHistoryLoading(true);
      await fetchFreshData(savedName, secret, !!cachedHistory);
    } catch {
      if (isMounted.current) {
        setHistoryLoading(false);
        setStatusText('Ne mogu da učitam istoriju.');
      }
    }
  };

  const fetchFreshData = async (name: string, secret: string, hasCachedHistory: boolean) => {
    if (!isMounted.current) return;
    if (!hasCachedHistory) setHistoryLoading(true);

    try {
      const freshEvents = ['Ukupno', ...(await getEventList())];
      if (isMounted.current) {
        setEventList(freshEvents);
        await saveWithExpiry(CACHE_KEYS.eventList, freshEvents, 60);
      }

      const data = await getUserData(name, secret);
      if (isMounted.current) {
        setUserHistory(data);
        await saveWithExpiry(CACHE_KEYS.history(name), data, 10);
        setStatusText(null);
      }
    } catch {
      if (isMounted.current && !hasCachedHistory) {
        setUserHistory([]);
        setStatusText('Istorija trenutno nije dostupna. Povuci za ponovno učitavanje.');
      }
    } finally {
      if (isMounted.current) {
        setHistoryLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const { name, secret } = await getSecurityCredentials();
    if (!name || name === 'Gost') {
      setRefreshing(false);
      return;
    }
    await fetchFreshData(name, secret, userHistory.length > 0);
  };

  const AchievementCard = ({
    data,
    currentVal,
    unit,
  }: {
    data: MilestoneProgress;
    currentVal: number;
    unit: string;
  }) => (
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
              <TouchableOpacity accessibilityRole="button" onPress={() => setModalVisible(false)}>
                <Text style={localStyles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {milestones.map((m) => {
                const isUnlocked = currentVal >= m.limit;
                return (
                  <View key={m.img} style={localStyles.milestoneRow}>
                    <Image
                      source={getMilestoneImage(m.img)}
                      style={[localStyles.modalRowImage, !isUnlocked && { opacity: 0.25 }]}
                      resizeMode="contain"
                    />
                    <View style={localStyles.modalRowInfo}>
                      <Text style={[localStyles.modalRowLabel, !isUnlocked && { color: '#888' }]}>
                        {m.label} {isUnlocked ? '✓' : `(${m.limit}${unit})`}
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={sharedStyles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {statusText && <Text style={localStyles.statusText}>{statusText}</Text>}

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
                onValueChange={(val) => setSelectedEvent(String(val))}
              >
                {eventList.map((evt) => (
                  <Picker.Item key={evt} label={evt} value={evt} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={localStyles.achievementRow}>
            <TouchableOpacity
              accessibilityRole="button"
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
              accessibilityRole="button"
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
            {historyLoading && userHistory.length > 0 && (
              <ActivityIndicator size="small" color="#2196F3" />
            )}
          </View>

          {historyLoading && currentRows.length === 0 ? (
            <LoadingState />
          ) : currentRows.length === 0 ? (
            <EmptyState
              label={
                userName === 'Gost'
                  ? 'Prvo sačuvaj ime na ekranu za skeniranje.'
                  : 'Još uvek nemaš zabeleženih poseta.'
              }
            />
          ) : (
            currentRows.map((item, i) => (
              <TouchableOpacity
                key={item.id ?? `${item.event}-${item.checkin}-${i}`}
                accessibilityRole={item.note ? 'button' : undefined}
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

          {filteredHistory.length > rowsPerPage && (
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage((p) => p - 1)}
              onNext={() => setCurrentPage((p) => p + 1)}
            />
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
                  accessibilityRole="button"
                  style={localStyles.stickyCloseBtn}
                  onPress={() => setNoteModalVisible(false)}
                >
                  <Text style={localStyles.stickyCloseText}>Zatvori</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {toast && <ToastMessage message={toast.message} type={toast.type} />}
        </View>
      </ScrollView>
      <MilestoneModal />
    </View>
  );
}

const localStyles = StyleSheet.create({
  statusText: {
    backgroundColor: '#FFF8E1',
    color: '#8A6D1D',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  achCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 5,
    elevation: 3,
    shadowColor: '#000',
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
    backgroundColor: '#FFF59D',
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
  stickyNoteScroll: { maxHeight: 250 },
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
