import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Leaderboard from '../../app/(tabs)/Leaderboard';
import { getEventList, getLeaderboard } from '../api';
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
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (styles) => styles },
  Platform: { OS: 'web', select: (options) => options.web ?? options.default },
}));
jest.mock('../api', () => ({ getEventList: jest.fn(), getLeaderboard: jest.fn() }));
jest.mock('../storageHelper', () => ({
  CACHE_KEYS: {
    leaderboard: (event) => `cached_leaderboard_${event}`,
    eventList: 'cached_event_list',
  },
  getWithExpiry: jest.fn(),
  saveWithExpiry: jest.fn(),
}));
jest.mock('../ui', () => ({
  EmptyState: 'EmptyState',
  LoadingState: 'LoadingState',
  PaginationControls: 'PaginationControls',
}));

const rankings = (name) => ({
  userRanking: [{ name, total: 1, totalMs: 1000, timeStr: '1s' }],
  locationRanking: [],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

describe('Leaderboard loading', () => {
  let renderer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    getWithExpiry.mockResolvedValue(null);
    saveWithExpiry.mockResolvedValue();
    getEventList.mockResolvedValue(['Event A', 'Event B']);
    getLeaderboard.mockResolvedValue(rankings('Ana'));
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
      renderer = TestRenderer.create(<Leaderboard />);
    });
  };
  const displayedText = () =>
    renderer.root
      .findAllByType('Text')
      .flatMap((node) => node.children.filter((child) => typeof child === 'string'))
      .join(' ');
  const chooseEvent = async (event) => {
    await act(async () => renderer.root.findByType('Picker').props.onValueChange(event));
  };
  const refresh = async () => {
    await act(async () =>
      renderer.root.findByType('ScrollView').props.refreshControl.props.onRefresh()
    );
  };
  const revisit = async () => {
    mockFocused = false;
    await act(async () => renderer.update(<Leaderboard />));
    mockFocused = true;
    await act(async () => renderer.update(<Leaderboard />));
  };

  it('uses valid caches on repeat visits but fetches on explicit refresh', async () => {
    getWithExpiry.mockImplementation(async (key) =>
      key === CACHE_KEYS.eventList ? ['Ukupno', 'Event A'] : rankings('Cached user')
    );
    await mount();
    await revisit();
    expect(displayedText()).toContain('Cached user');
    expect(getLeaderboard).not.toHaveBeenCalled();
    expect(getEventList).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
    await refresh();
    expect(getLeaderboard).toHaveBeenCalledTimes(1);
    expect(getEventList).toHaveBeenCalledTimes(1);
    expect(displayedText()).toContain('Ana');
  });

  it('loads rankings independently of a slow event list without reloading it on filter changes', async () => {
    const events = deferred();
    getEventList.mockReturnValue(events.promise);
    await mount();
    expect(displayedText()).toContain('Ana');
    await chooseEvent('Event A');
    expect(getLeaderboard).toHaveBeenLastCalledWith('Event A');
    expect(getEventList).toHaveBeenCalledTimes(1);
    await act(async () => events.resolve(['Event A']));
  });

  it('ignores an older response after the selected filter changes', async () => {
    await mount();
    const old = deferred();
    getLeaderboard.mockReturnValueOnce(old.promise);
    await chooseEvent('Event A');
    getLeaderboard.mockResolvedValueOnce(rankings('Current user'));
    await chooseEvent('Event B');
    await act(async () => old.resolve(rankings('Old user')));
    expect(displayedText()).toContain('Current user');
    expect(displayedText()).not.toContain('Old user');
    expect(saveWithExpiry).not.toHaveBeenCalledWith(
      CACHE_KEYS.leaderboard('Event A'),
      rankings('Old user'),
      5
    );
  });

  it('fetches again after cache invalidation and never restores an older visit', async () => {
    const old = deferred();
    getLeaderboard.mockReturnValueOnce(old.promise);
    await mount();
    getLeaderboard.mockResolvedValueOnce(rankings('After scan'));
    await revisit();
    await act(async () => old.resolve(rankings('Before scan')));
    expect(getLeaderboard).toHaveBeenCalledTimes(2);
    expect(displayedText()).toContain('After scan');
    expect(displayedText()).not.toContain('Before scan');
  });

  it('loads and refreshes all-time rankings when the combined tab is selected', async () => {
    await mount();
    await chooseEvent('Event A');
    expect(getLeaderboard).toHaveBeenCalledTimes(2);
    getLeaderboard.mockResolvedValue(rankings('Total user'));
    await act(async () => renderer.root.findAllByType('TouchableOpacity')[2].props.onPress());
    expect(getLeaderboard).toHaveBeenLastCalledWith('Ukupno');
    expect(displayedText()).toContain('Total user');
    await refresh();
    expect(getLeaderboard).toHaveBeenLastCalledWith('Ukupno');
    expect(getLeaderboard).toHaveBeenCalledTimes(4);
  });

  it('keeps fetched results usable when local cache reads and writes fail', async () => {
    getWithExpiry.mockRejectedValue(new Error('storage unavailable'));
    saveWithExpiry.mockRejectedValue(new Error('storage unavailable'));
    await mount();
    expect(displayedText()).toContain('Ana');
    expect(displayedText()).not.toContain('Ne mogu da');
    expect(renderer.root.findAllByType('LoadingState')).toHaveLength(0);
  });

  it('retains cached rankings when a forced refresh fails', async () => {
    getWithExpiry.mockImplementation(async (key) =>
      key === CACHE_KEYS.eventList ? ['Ukupno'] : rankings('Cached user')
    );
    await mount();
    getLeaderboard.mockRejectedValue(new Error('offline'));
    await refresh();
    expect(displayedText()).toContain('Cached user');
    expect(displayedText()).toContain('Ne mogu da');
    expect(saveWithExpiry).not.toHaveBeenCalledWith(
      CACHE_KEYS.leaderboard('Ukupno'),
      expect.anything(),
      expect.anything()
    );
    expect(renderer.root.findByType('ScrollView').props.refreshControl.props.refreshing).toBe(
      false
    );
  });
});
