export interface HistoryItem {
  id?: string | number;
  checkin: string;
  checkout: string | null;
  event: string;
  note?: string | null;
}

export interface RankingItem {
  name: string;
  total: number;
  totalMs: number;
  timeStr: string;
}

export interface RankingsData {
  userRanking: RankingItem[];
  locationRanking: RankingItem[];
}

export interface CombinedRankingItem extends RankingItem {
  location: string | null;
}

export interface InviteItem {
  timestamp: string;
  type?: string;
  sender: string;
  message: string;
}

export type ScanResult =
  | { status: 'checkin' | 'checkout'; message: string }
  | { status: 'rejected'; message: string };

export const API_URL =
  'https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec';

const emptyRankings: RankingsData = {
  userRanking: [],
  locationRanking: [],
};

function withTimestamp(url: string): string {
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}t=${Date.now()}`;
}

const pendingReads = new Map<string, Promise<unknown>>();
const READ_TIMEOUT_MS = 20000;

function readJson<T>(url: string): Promise<T> {
  const pending = pendingReads.get(url);
  if (pending) return pending as Promise<T>;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Request timed out'));
      controller.abort();
    }, READ_TIMEOUT_MS);
  });
  const request = Promise.race([
    (async () => {
      const response = await fetch(withTimestamp(url), { signal: controller.signal });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return (await response.json()) as T;
    })(),
    deadline,
  ]).finally(() => {
    clearTimeout(timeout);
    if (pendingReads.get(url) === request) pendingReads.delete(url);
  });
  pendingReads.set(url, request);
  return request;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRankingItem(item: Partial<RankingItem>): RankingItem {
  return {
    name: String(item.name ?? ''),
    total: toNumber(item.total),
    totalMs: toNumber(item.totalMs),
    timeStr: String(item.timeStr ?? ''),
  };
}

export function normalizeRankings(value: unknown): RankingsData {
  if (!value || typeof value !== 'object' || 'error' in value) {
    return emptyRankings;
  }

  const data = value as Partial<Record<keyof RankingsData, unknown>>;
  return {
    userRanking: Array.isArray(data.userRanking)
      ? data.userRanking.map((item) => normalizeRankingItem(item as Partial<RankingItem>))
      : [],
    locationRanking: Array.isArray(data.locationRanking)
      ? data.locationRanking.map((item) => normalizeRankingItem(item as Partial<RankingItem>))
      : [],
  };
}

export function parseScanResult(value: string): ScanResult {
  const message = value.trim();

  if (!message || message.startsWith('Error')) {
    return {
      status: 'rejected',
      message: message || 'Server nije potvrdio skeniranje.',
    };
  }

  if (message.includes('Checkout')) {
    return { status: 'checkout', message };
  }

  if (message.includes('Success')) {
    return { status: 'checkin', message };
  }

  return { status: 'rejected', message };
}

export async function getEventList(): Promise<string[]> {
  const data = await readJson<unknown>(`${API_URL}?action=getEventList`);
  if (!Array.isArray(data)) throw new Error('Invalid event list response');
  return data.map(String);
}

export async function getUserData(name: string, secret: string): Promise<HistoryItem[]> {
  const data = await readJson<unknown>(
    `${API_URL}?action=getUserData&name=${encodeURIComponent(
      name.trim()
    )}&secret=${encodeURIComponent(secret)}`
  );
  if (!Array.isArray(data)) throw new Error('Invalid history response');
  return data as HistoryItem[];
}

export async function getLeaderboard(eventFilter: string): Promise<RankingsData> {
  const filter = eventFilter === 'Ukupno' ? '' : eventFilter;
  const data = await readJson<unknown>(
    `${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}`
  );
  if (
    !data ||
    typeof data !== 'object' ||
    'error' in data ||
    !('userRanking' in data) ||
    !Array.isArray(data.userRanking) ||
    !('locationRanking' in data) ||
    !Array.isArray(data.locationRanking)
  ) {
    throw new Error('Invalid leaderboard response');
  }
  return normalizeRankings(data);
}

export async function getInvites(): Promise<InviteItem[]> {
  const data = await readJson<unknown>(`${API_URL}?action=getInvites`);
  return Array.isArray(data) ? (data as InviteItem[]) : [];
}

export async function submitScan(name: string, secret: string, event: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ name: name.trim(), secret, event: event.trim() }),
  });

  if (!response.ok) {
    throw new Error(`Scan failed with ${response.status}`);
  }

  const text = await response.text();
  // Reads started before this write must not be reused after a confirmed scan.
  if (parseScanResult(text).status !== 'rejected') pendingReads.clear();
  return text;
}

export async function sendInvite(name: string, secret: string, message: string): Promise<void> {
  const response = await fetch(
    withTimestamp(
      `${API_URL}?action=sendInvite&name=${encodeURIComponent(name)}&secret=${encodeURIComponent(
        secret
      )}&msg=${encodeURIComponent(message)}`
    )
  );

  if (!response.ok) {
    throw new Error(`Invite failed with ${response.status}`);
  }
}
