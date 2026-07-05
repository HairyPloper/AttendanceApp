import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      style={[uiStyles.primaryButton, disabled && uiStyles.disabledButton]}
      onPress={onPress}
    >
      <Text style={uiStyles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ToastMessage({ message, type }: { message: string; type: ToastType }) {
  return (
    <View style={[uiStyles.toast, uiStyles[type]]}>
      <Text style={uiStyles.toastText}>{message}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Ucitavanje...' }: { label?: string }) {
  return (
    <View style={uiStyles.centerBlock}>
      <ActivityIndicator size="large" color="#2196F3" />
      <Text style={uiStyles.centerText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View style={uiStyles.centerBlock}>
      <Text style={uiStyles.emptyText}>{label}</Text>
    </View>
  );
}

export function PaginationControls({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View style={uiStyles.paginationRow}>
      <TouchableOpacity disabled={page === 1} onPress={onPrevious}>
        <Text style={[uiStyles.pageAction, page === 1 && uiStyles.disabledText]}>Nazad</Text>
      </TouchableOpacity>
      <View style={uiStyles.pageDisplay}>
        <Text style={uiStyles.pageInfo}>
          {page} / {totalPages}
        </Text>
      </View>
      <TouchableOpacity disabled={page === totalPages} onPress={onNext}>
        <Text style={[uiStyles.pageAction, page === totalPages && uiStyles.disabledText]}>
          Napred
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const uiStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 34,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  centerBlock: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 12,
    color: '#2196F3',
    fontWeight: '700',
  },
  emptyText: {
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  pageAction: {
    fontSize: 14,
    fontWeight: '800',
    color: '#007AFF',
    padding: 5,
  },
  disabledText: {
    color: '#C7C7CC',
  },
  pageDisplay: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageInfo: {
    fontSize: 12,
    color: '#666',
  },
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
  toastText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 15,
  },
});
