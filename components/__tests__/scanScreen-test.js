import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ScanScreen from '../../app/(tabs)/index';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockInvalidateAttendanceCaches = jest.fn();
const mockReplace = jest.fn();
const mockSubmitScan = jest.fn();
const mockGetUserData = jest.fn();
const originalConsoleError = console.error;

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  DeviceEventEmitter: { emit: jest.fn() },
  Keyboard: { dismiss: jest.fn() },
  Platform: { OS: 'web' },
  StyleSheet: {
    absoluteFillObject: {},
    create: (styles) => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('../api', () => ({
  parseScanResult: jest.requireActual('../api').parseScanResult,
  submitScan: (...args) => mockSubmitScan(...args),
  getUserData: (...args) => mockGetUserData(...args),
}));

jest.mock('../securityHelper', () => ({
  getSecurityCredentials: jest.fn(() => Promise.resolve({ name: 'Ana', secret: 'secret' })),
}));

jest.mock('../storageHelper', () => ({
  CACHE_KEYS: {
    history: (name) => `cache_history_${name}`,
    visitCount: (name) => `cached_visit_count_${name}`,
  },
  getWithExpiry: jest.fn(() => Promise.resolve([])),
  invalidateAttendanceCaches: (...args) => mockInvalidateAttendanceCaches(...args),
  saveWithExpiry: jest.fn(() => Promise.resolve()),
}));

jest.mock('../ui', () => ({
  PrimaryButton: 'PrimaryButton',
  ToastMessage: 'ToastMessage',
}));

describe('ScanScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockInvalidateAttendanceCaches.mockResolvedValue();
    AsyncStorage.getItem.mockResolvedValue('Ana');
    jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (String(message).startsWith('react-test-renderer is deprecated')) return;
      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    console.error.mockRestore();
    jest.useRealTimers();
  });

  it('opens the scanner without fetching history for decoration on a cache miss', async () => {
    const { getWithExpiry } = require('../storageHelper');
    getWithExpiry.mockResolvedValueOnce(null);
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === 'user_name' ? 'Ana' : '25')
    );
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<ScanScreen />);
    });
    expect(renderer.root.findByType('CameraView')).toBeTruthy();
    expect(mockGetUserData).not.toHaveBeenCalled();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('cached_visit_count_Ana');
    await act(async () => renderer.unmount());
  });

  it('navigates promptly after success, but waits for stale history to be invalidated', async () => {
    mockSubmitScan.mockResolvedValue('Check-in Success');
    let invalidate;
    mockInvalidateAttendanceCaches.mockReturnValue(
      new Promise((resolve) => {
        invalidate = resolve;
      })
    );
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<ScanScreen />);
    });
    await act(async () => {
      await renderer.root.findByType('CameraView').props.onBarcodeScanned({ data: 'Event A' });
      jest.advanceTimersByTime(300);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      invalidate();
    });
    expect(mockReplace).toHaveBeenCalledWith('/UserHistory');
    await act(async () => renderer.unmount());
  });

  it('submits duplicate camera events once and keeps cache failure non-critical', async () => {
    let resolveSubmit;
    mockSubmitScan.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    mockInvalidateAttendanceCaches.mockRejectedValue(new Error('storage unavailable'));

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<ScanScreen />);
    });

    const cameraProps = renderer.root.findByType('CameraView').props;
    expect(cameraProps).toMatchObject({ autofocus: 'on', zoom: 0.1 });
    expect(cameraProps.ratio).toBeUndefined();
    expect(renderer.root.findByProps({ nativeID: 'ranked-scanner-frame' })).toBeTruthy();

    const scan = cameraProps.onBarcodeScanned;
    let firstScan;
    await act(async () => {
      firstScan = scan({ data: 'Event A' });
      scan({ data: 'Event A' });
      await Promise.resolve();
    });

    expect(mockSubmitScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit('Check-in Success');
      await firstScan;
      await Promise.resolve();
    });

    expect(mockInvalidateAttendanceCaches).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType('ToastMessage').props).toMatchObject({
      message: 'Skeniranje je sačuvano, ali lokalni podaci nisu osveženi.',
      type: 'info',
    });

    await act(async () => renderer.unmount());
  });

  it('does not run post-success work when the server rejects a scan', async () => {
    mockSubmitScan.mockResolvedValue('Error: User not verified');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<ScanScreen />);
    });

    await act(async () => {
      await renderer.root.findByType('CameraView').props.onBarcodeScanned({ data: 'Event B' });
    });

    expect(mockInvalidateAttendanceCaches).not.toHaveBeenCalled();
    expect(renderer.root.findByType('ToastMessage').props).toMatchObject({
      message: 'Error: User not verified',
      type: 'error',
    });

    await act(async () => renderer.unmount());
  });
});
