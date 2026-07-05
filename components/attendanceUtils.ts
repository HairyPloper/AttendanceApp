import { CombinedRankingItem, RankingsData } from './api';

export interface Milestone {
  limit: number;
  label: string;
  img: string;
  sub: string;
}

export interface MilestoneProgress {
  current: Milestone;
  next: Milestone;
  progress: number;
}

export interface HostLocation {
  user: string;
  location: string;
}

export function formatDateTime(dateString: string | null) {
  if (!dateString) return '--:--:--';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function calculateTotalTime(start: string, end: string | null) {
  if (!end) return 'Aktivna Sesija';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return '0s';
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m ${s}s`;
}

export function getMilestone(val: number, milestones: Milestone[]): MilestoneProgress {
  let current = milestones[0];
  let next = milestones[1] || milestones[0];
  for (let i = 0; i < milestones.length; i++) {
    if (val >= milestones[i].limit) {
      current = milestones[i];
      next = milestones[i + 1] || milestones[i];
    }
  }
  const progress = Math.min(val / next.limit, 1);
  return { current, next, progress };
}

export function msToTimeStr(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function buildCombinedRanking(
  snapshot: RankingsData,
  hostLocationMap: HostLocation[]
): CombinedRankingItem[] {
  const result = snapshot.userRanking.map((userEntry) => {
    const mapping = hostLocationMap.find(
      (m) => m.user.toLowerCase() === userEntry.name.toLowerCase()
    );
    const locEntry = mapping
      ? snapshot.locationRanking.find(
          (r) => r.name.toLowerCase() === mapping.location.toLowerCase()
        )
      : undefined;

    const totalMs = userEntry.totalMs + (locEntry?.totalMs ?? 0);
    const total = userEntry.total + (locEntry?.total ?? 0);

    return {
      name: userEntry.name,
      location: mapping?.location ?? null,
      total,
      totalMs,
      timeStr: locEntry ? msToTimeStr(totalMs) : userEntry.timeStr,
    };
  });

  return result.sort((a, b) => b.totalMs - a.totalMs);
}
