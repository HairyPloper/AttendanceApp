export const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

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