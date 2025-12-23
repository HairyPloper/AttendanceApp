import { Platform, StyleSheet } from 'react-native';

// We use 'export' here so other files can see 'sharedStyles'
export const sharedStyles = StyleSheet.create({
  scrollContainer: { padding: 15 },
  profileHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 15, 
    elevation: 2 
  },
  welcomeText: { fontSize: 12, color: '#888' },
  userNameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  refreshBtn: { 
    backgroundColor: '#2196F3', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  dataBox: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 15, 
    elevation: 3 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0', 
    paddingBottom: 10 
  },
  subTitle: { fontWeight: 'bold', fontSize: 18, color: '#333' },
  pickerContainer: { 
    height: 45, 
    width: 140, 
    backgroundColor: '#f9f9f9', 
    borderRadius: 8, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#eee' 
  },
  picker: { height: 45, width: '100%' },
  historyItemContainer: { 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  historyTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  itemEventText: { fontSize: 16, fontWeight: '600', color: '#444' },
  durationText: { color: '#2196F3', fontWeight: 'bold' },
  timeDetailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 10, color: '#999', marginBottom: 2 },
  dateText: { color: '#555', fontSize: 12, fontWeight: '500' },
  listItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f9f9f9', 
    alignItems: 'center' 
  },
  itemText: { fontSize: 16 },
  timeSubtext: { fontSize: 11, color: '#888', marginLeft: 26 },
  countText: { fontWeight: 'bold', color: '#2196F3', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 30 },
  paginationRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 15 
  },
  pageInfo: { fontSize: 12, color: '#666' },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5', // Light grey background for the "track"
    padding: 4,
    borderRadius: 10,
  },
  chipLabel: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 8,
    fontWeight: '600',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeChip: {
    backgroundColor: '#fff', // White "card" look for the active item
    ...Platform.select({web:{boxShadow:'0px 4px 10px rgba(0,0,0,0.1)'},default:{elevation:2}})
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeChipText: {
    color: '#2196F3', // Your professional blue
    fontWeight: 'bold',
  },
  modernPickerWrapper: {
    width: 160,
    height: 40,
    position: 'relative',
  },
  // This is the pretty background
  visualPickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D0E4FF',
  },
  pickerIcon: {
    fontFamily: 'LocalFontAwesome',
    fontSize: 14,
    color: '#2196F3',
    marginRight: 8,
  },
  pickerText: {
    flex: 1,
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
  },
  chevronIcon: {
    fontFamily: 'LocalFontAwesome',
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  // This makes the ugly black box/border disappear
  invisiblePicker: {
    width: '100%',
    height: '100%',
    opacity: 0, // Makes it invisible but still functional
    position: 'absolute',
  },
});