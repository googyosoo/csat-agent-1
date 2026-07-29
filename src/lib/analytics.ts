/**
 * Student Analytics & Learning Tracking Engine
 */

export interface StudentActivity {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  loginCount: number;
  lastLogin: string;
  totalDwellTimeMinutes: number;
  completedPassagesCount: number;
  transformedQuestionsGenerated: number;
  quizAccuracyPercentage: number;
  socraticQuestionsCount: number;
  status: 'online' | 'offline';
}

export interface SocraticSummary {
  id: string;
  studentEmail: string;
  studentName: string;
  passageTitle: string;
  lesson: string;
  itemNo: string;
  timestamp: string;
  studentQuestionSnippet: string;
  aiHintLevel: number;
  keyTopic: string;
  metacognitiveStatus: '우수 (구문 파악 성공)' | '보통 (힌트 유도 필요)' | '집중 필요 (어휘 보강)';
}

export interface AnalyticsMetrics {
  totalStudents: number;
  totalLogins: number;
  avgDwellTimeMinutes: number;
  totalGeneratedQuestions: number;
  totalSocraticConversations: number;
}

// Initial mock dataset for student analytics
export const INITIAL_STUDENT_ACTIVITIES: StudentActivity[] = [
  {
    id: 'std-1',
    email: 'student_kim@simin.hs.kr',
    name: '김수능 (3학년 1반)',
    loginCount: 24,
    lastLogin: '2026-07-29 09:30',
    totalDwellTimeMinutes: 185,
    completedPassagesCount: 14,
    transformedQuestionsGenerated: 12,
    quizAccuracyPercentage: 83.5,
    socraticQuestionsCount: 19,
    status: 'online',
  },
  {
    id: 'std-2',
    email: 'park_english@simin.hs.kr',
    name: '박영희 (3학년 2반)',
    loginCount: 18,
    lastLogin: '2026-07-29 08:45',
    totalDwellTimeMinutes: 142,
    completedPassagesCount: 10,
    transformedQuestionsGenerated: 8,
    quizAccuracyPercentage: 90.0,
    socraticQuestionsCount: 15,
    status: 'online',
  },
  {
    id: 'std-3',
    email: 'lee_csat2027@gmail.com',
    name: '이민준 (N수생)',
    loginCount: 31,
    lastLogin: '2026-07-28 22:15',
    totalDwellTimeMinutes: 260,
    completedPassagesCount: 18,
    transformedQuestionsGenerated: 21,
    quizAccuracyPercentage: 94.2,
    socraticQuestionsCount: 28,
    status: 'offline',
  },
  {
    id: 'std-4',
    email: 'choi_scholar@simin.hs.kr',
    name: '최지훈 (3학년 1반)',
    loginCount: 12,
    lastLogin: '2026-07-28 17:10',
    totalDwellTimeMinutes: 95,
    completedPassagesCount: 7,
    transformedQuestionsGenerated: 5,
    quizAccuracyPercentage: 75.0,
    socraticQuestionsCount: 8,
    status: 'offline',
  },
  {
    id: 'std-5',
    email: 'jung_pass@naver.com',
    name: '정서연 (3학년 4반)',
    loginCount: 15,
    lastLogin: '2026-07-29 09:12',
    totalDwellTimeMinutes: 110,
    completedPassagesCount: 9,
    transformedQuestionsGenerated: 7,
    quizAccuracyPercentage: 88.0,
    socraticQuestionsCount: 11,
    status: 'online',
  },
];

export const INITIAL_SOCRATIC_SUMMARIES: SocraticSummary[] = [
  {
    id: 'soc-1',
    studentEmail: 'student_kim@simin.hs.kr',
    studentName: '김수능',
    passageTitle: '인공지능과 비판적 사고의 상호작용',
    lesson: '08강',
    itemNo: '01번',
    timestamp: '2026-07-29 09:25',
    studentQuestionSnippet: 'However 뒷문장에서 주어-동사 수일치와 역접 어조가 어떻게 연결되나요?',
    aiHintLevel: 2,
    keyTopic: '역접 연결어를 통한 논지 전환 및 주어절 판별',
    metacognitiveStatus: '우수 (구문 파악 성공)',
  },
  {
    id: 'soc-2',
    studentEmail: 'park_english@simin.hs.kr',
    studentName: '박영희',
    passageTitle: '디지털 필터 버블과 민주적 담론',
    lesson: '09강',
    itemNo: '02번',
    timestamp: '2026-07-29 08:40',
    studentQuestionSnippet: 'filter bubble 단어의 문맥상 비판적 어조의 의미가 이해되지 않아요.',
    aiHintLevel: 1,
    keyTopic: '문맥적 어휘 적절성 및 어조 파악',
    metacognitiveStatus: '보통 (힌트 유도 필요)',
  },
  {
    id: 'soc-3',
    studentEmail: 'lee_csat2027@gmail.com',
    studentName: '이민준',
    passageTitle: '글로벌 경제 통합과 지역 문화 보존',
    lesson: '10강',
    itemNo: '03번',
    timestamp: '2026-07-28 22:05',
    studentQuestionSnippet: '가주어 It - 진주어 to부정사 구문의 변형문제 빈칸 핵심 어구가 무엇인가요?',
    aiHintLevel: 3,
    keyTopic: '가주어-진주어 패러프레이징 빈칸 추론',
    metacognitiveStatus: '우수 (구문 파악 성공)',
  },
  {
    id: 'soc-4',
    studentEmail: 'choi_scholar@simin.hs.kr',
    studentName: '최지훈',
    passageTitle: '환경 보존과 실증적 데이터 분석',
    lesson: '11강',
    itemNo: '01번',
    timestamp: '2026-07-28 17:00',
    studentQuestionSnippet: '관계대명사 that절 수식 범위 구별이 어렵습니다.',
    aiHintLevel: 2,
    keyTopic: '관계절 수식 범위 및 어법 판단',
    metacognitiveStatus: '집중 필요 (어휘 보강)',
  },
];

/**
 * Calculate overall metrics from student activity data
 */
export function calculateAnalyticsMetrics(students: StudentActivity[]): AnalyticsMetrics {
  const totalStudents = students.length;
  const totalLogins = students.reduce((acc, s) => acc + s.loginCount, 0);
  const totalDwell = students.reduce((acc, s) => acc + s.totalDwellTimeMinutes, 0);
  const avgDwellTimeMinutes = totalStudents > 0 ? Math.round(totalDwell / totalStudents) : 0;
  const totalGeneratedQuestions = students.reduce((acc, s) => acc + s.transformedQuestionsGenerated, 0);
  const totalSocraticConversations = students.reduce((acc, s) => acc + s.socraticQuestionsCount, 0);

  return {
    totalStudents,
    totalLogins,
    avgDwellTimeMinutes,
    totalGeneratedQuestions,
    totalSocraticConversations,
  };
}
