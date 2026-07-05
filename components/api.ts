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

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(withTimestamp(url));
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
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

export async function getEventList(): Promise<string[]> {
  const data = await readJson<unknown>(`${API_URL}?action=getEventList`);
  return Array.isArray(data) ? data.map(String) : [];
}

export async function getUserData(name: string, secret: string): Promise<HistoryItem[]> {
  const data = await readJson<unknown>(
    `${API_URL}?action=getUserData&name=${encodeURIComponent(
      name.trim()
    )}&secret=${encodeURIComponent(secret)}`
  );
  return Array.isArray(data) ? (data as HistoryItem[]) : [];
}

export async function getLeaderboard(eventFilter: string): Promise<RankingsData> {
  const filter = eventFilter === 'Ukupno' ? '' : eventFilter;
  const data = await readJson<unknown>(
    `${API_URL}?action=getLeaderboard&event=${encodeURIComponent(filter)}`
  );
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

  return response.text();
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
