import { ImageSourcePropType } from 'react-native';
import { Milestone } from './attendanceUtils';

export type VisitImageKey =
  | 'visits_1'
  | 'visits_5'
  | 'visits_10'
  | 'visits_25'
  | 'visits_50'
  | 'visits_100';

export interface VisitRankTheme {
  minVisits: number;
  label: string;
  code: string;
  image?: VisitImageKey;
  tier: number;
  primary: string;
  secondary: string;
  glow: string;
  target: string;
}

export const VISIT_MILESTONES: Milestone[] = [
  { limit: 1, label: 'Srednjoškolac', img: 'visits_1', sub: 'Ide u srednju školu.' },
  { limit: 5, label: 'Gaijin', img: 'visits_5', sub: 'Još uvek stranac.' },
  { limit: 10, label: 'Street Racer', img: 'visits_10', sub: 'Dobro poznaje miris asfalta.' },
  { limit: 25, label: 'Challenger', img: 'visits_25', sub: 'Ulice ga poznaju.' },
  { limit: 50, label: 'Han', img: 'visits_50', sub: 'Ima svoju garažu.' },
  { limit: 100, label: 'D.K. (Legend)', img: 'visits_100', sub: 'Gospodar planine.' },
];

const VISIT_RANK_THEMES: VisitRankTheme[] = [
  {
    minVisits: 0,
    label: 'Stranac',
    code: 'GST',
    tier: 0,
    primary: '#F0F0F0',
    secondary: '#FFFFFF',
    glow: 'transparent',
    target: '#FFFFFF',
  },
  {
    minVisits: 1,
    label: 'Srednjoškolac',
    code: 'SCH',
    image: 'visits_1',
    tier: 1,
    primary: '#A85F2E',
    secondary: '#E3A36B',
    glow: 'rgba(168, 95, 46, 0.30)',
    target: '#F4C99C',
  },
  {
    minVisits: 5,
    label: 'Gaijin',
    code: 'GAI',
    image: 'visits_5',
    tier: 2,
    primary: '#7D8794',
    secondary: '#E1E7EE',
    glow: 'rgba(176, 187, 201, 0.32)',
    target: '#F5F8FC',
  },
  {
    minVisits: 10,
    label: 'Street Racer',
    code: 'STR',
    image: 'visits_10',
    tier: 3,
    primary: '#1687D9',
    secondary: '#6DE2FF',
    glow: 'rgba(22, 135, 217, 0.30)',
    target: '#8CEAFF',
  },
  {
    minVisits: 25,
    label: 'Challenger',
    code: 'CHR',
    image: 'visits_25',
    tier: 4,
    primary: '#D49A13',
    secondary: '#FFE071',
    glow: 'rgba(224, 169, 35, 0.38)',
    target: '#FFF1A3',
  },
  {
    minVisits: 50,
    label: 'Han',
    code: 'HAN',
    image: 'visits_50',
    tier: 5,
    primary: '#6E3FD5',
    secondary: '#C982FF',
    glow: 'rgba(110, 63, 213, 0.40)',
    target: '#E1B4FF',
  },
  {
    minVisits: 100,
    label: 'D.K. (Legend)',
    code: 'DK',
    image: 'visits_100',
    tier: 6,
    primary: '#C51F32',
    secondary: '#FF6B6B',
    glow: 'rgba(213, 31, 51, 0.48)',
    target: '#FFD1D1',
  },
];

export function getVisitRank(totalVisits: number): VisitRankTheme {
  const safeTotal = Number.isFinite(totalVisits) ? Math.max(0, totalVisits) : 0;
  let current = VISIT_RANK_THEMES[0];

  VISIT_RANK_THEMES.forEach((rank) => {
    if (safeTotal >= rank.minVisits) current = rank;
  });

  return current;
}

export function getVisitMilestoneImage(imgKey: string): ImageSourcePropType {
  switch (imgKey) {
    case 'visits_5':
      return require('../assets/images/visits_5-min.png');
    case 'visits_10':
      return require('../assets/images/visits_10-min.png');
    case 'visits_25':
      return require('../assets/images/visits_25-min.png');
    case 'visits_50':
      return require('../assets/images/visits_50-min.png');
    case 'visits_100':
      return require('../assets/images/visits_100-min.png');
    case 'visits_1':
    default:
      return require('../assets/images/visits_1-min.png');
  }
}
