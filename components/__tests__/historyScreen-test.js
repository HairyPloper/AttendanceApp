import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HistoryScreen from '../../app/(tabs)/UserHistory';
import { getEventList, getUserData } from '../api';
import { CACHE_KEYS, getWithExpiry, saveWithExpiry } from '../storageHelper';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mockFocused = true;

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  return {
    Picker: Object.assign((props) => React.createElement('Picker', props), { Item: 'PickerItem' }),
  };
});
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Modal: 'Modal',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (styles) => styles },
  Platform: { OS: 'web', select: (options) => options.web ?? options.default },
}));
jest.mock('../api', () => ({ getEventList: jest.fn(), getUserData: jest.fn() }));
jest.mock('../securityHelper', () => ({
  getSecurityCredentials: jest.fn(async () => ({ name: 'Ana', secret: 'secret' })),
}));
jest.mock('../storageHelper', () => ({
  CACHE_KEYS: {
    history: (name) => `cache_history_${name}`,
    visitCount: (name) => `cached_visit_count_${name}`,
    eventList: 'cached_event_list',
  },
  getWithExpiry: jest.fn(),
  saveWithExpiry: jest.fn(),
}));
jest.mock('../ui', () => ({
  EmptyState: 'EmptyState',
  LoadingState: 'LoadingState',
  PaginationControls: 'PaginationControls',
  ToastMessage: 'ToastMessage',
}));
jest.mock('../visitRanks', () => ({
  VISIT_MILESTONES: [{ limit: 1, label: 'Rank', img: 'visits_1', sub: 'Rank' }],
  getVisitMilestoneImage: () => 1,
}));
jest.mock('../../assets/images/time_1-min.png', () => 1);

const history = [{ id: 1, event: 'Event A', checkin: '2026-09-26T10:00:00Z', checkout: null }];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('HistoryScreen loading', () => {
  let renderer;
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    getWithExpiry.mockResolvedValue(null);
    saveWithExpiry.mockResolvedValue();
    getEventList.mockResolvedValue(['Event A']);
    getUserData.mockResolvedValue(history);
    AsyncStorage.setItem.mockResolvedValue();
    const original = console.error;
    jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (String(message).startsWith('react-test-renderer is deprecated')) return;
      original(message, ...args);
    });
  });
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    console.error.mockRestore();
  });

  const mount = async () => {
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
  };
  const displayedText = () =>
    renderer.root
      .findAllByType('Text')
      .flatMap((node) => node.children.filter((child) => typeof child === 'string'))
      .join(' ');

  it('renders history while the event-list request is still pending', async () => {
    const events = deferred();
    getEventList.mockReturnValue(events.promise);
    await mount();
    expect(getUserData).toHaveBeenCalledTimes(1);
    expect(displayedText()).toContain('Event A');
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEYS.visitCount('Ana'), '1');
    await act(async () => events.resolve(['Event A']));
  });

  it('renders history even if the event list fails', async () => {
    getEventList.mockRejectedValue(new Error('offline'));
    await mount();
    expect(displayedText()).toContain('Event A');
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
  });

  it('keeps fetched history visible when local cache writes fail', async () => {
    saveWithExpiry.mockRejectedValue(new Error('storage unavailable'));
    await mount();
    expect(displayedText()).toContain('Event A');
    expect(displayedText()).not.toContain('Istorija trenutno nije dostupna');
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
  });

  it('reuses valid caches across tab visits and fetches on explicit refresh', async () => {
    getWithExpiry.mockImplementation(async (key) =>
      key === CACHE_KEYS.eventList ? ['Ukupno', 'Event A'] : history
    );
    await mount();
    expect(getUserData).not.toHaveBeenCalled();
    expect(getEventList).not.toHaveBeenCalled();
    mockFocused = false;
    await act(async () => renderer.update(<HistoryScreen />));
    mockFocused = true;
    await act(async () => renderer.update(<HistoryScreen />));
    expect(getUserData).not.toHaveBeenCalled();
    const refresh = renderer.root
      .findAllByType('ScrollView')
      .find((node) => node.props.refreshControl).props.refreshControl.props.onRefresh;
    await act(async () => refresh());
    expect(getUserData).toHaveBeenCalledTimes(1);
    expect(getEventList).toHaveBeenCalledTimes(1);
  });

  it('treats cached empty history as loaded', async () => {
    getWithExpiry.mockImplementation(async (key) =>
      key === CACHE_KEYS.eventList ? ['Ukupno'] : []
    );
    await mount();
    expect(getUserData).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
    expect(renderer.root.findAllByType('EmptyState')).toHaveLength(1);
  });

  it('does not overwrite current history with an old request after switching tabs', async () => {
    const old = deferred();
    getUserData.mockReturnValueOnce(old.promise);
    await mount();
    mockFocused = false;
    await act(async () => renderer.update(<HistoryScreen />));
    mockFocused = true;
    await act(async () => renderer.update(<HistoryScreen />));
    await act(async () => old.resolve([{ ...history[0], event: 'Old event' }]));
    expect(displayedText()).toContain('Event A');
    expect(displayedText()).not.toContain('Old event');
    expect(saveWithExpiry).not.toHaveBeenCalledWith(
      CACHE_KEYS.history('Ana'),
      expect.arrayContaining([expect.objectContaining({ event: 'Old event' })]),
      10
    );
  });
});
