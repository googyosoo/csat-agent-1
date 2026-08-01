import { EBSPassage } from '../types';
import { INITIAL_EBS_DATASET } from './ebsDataset';

export interface SubjectConfig {
  id: string;
  name: string;
  shortName: string;
  badgeColor: string;
  dataset: EBSPassage[];
  description: string;
}

export const SUBJECTS: SubjectConfig[] = [
  {
    id: 'jinro',
    name: '2027 진로영어',
    shortName: '진로영어',
    badgeColor: 'bg-blue-600',
    dataset: INITIAL_EBS_DATASET,
    description: '2027학년도 EBS 연계 진로영어 30개 핵심 지문 및 실전 수능 변형문항',
  },
  {
    id: 'simhwa2',
    name: '2027 심화영어II',
    shortName: '심화영어II',
    badgeColor: 'bg-purple-600',
    dataset: INITIAL_EBS_DATASET, // 과목 데이터셋 확장 구조
    description: '2027학년도 EBS 연계 심화영어II 46개 수능 킬러/고난도 지문',
  },
];
