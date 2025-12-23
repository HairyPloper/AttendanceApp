export const API_URL = "";

export interface HistoryItem {
  checkin: string;
  checkout: string | null;
  event: string;
}

export interface LeaderboardItem {
  name: string;
  total: number;
  timeStr: string;
}