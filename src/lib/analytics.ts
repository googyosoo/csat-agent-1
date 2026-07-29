/**
 * Real-time Student Analytics & Learning Tracking Engine with LocalStorage Persistence
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

const STORAGE_KEY_STUDENTS = 'csat_analytics_students_v1';
const STORAGE_KEY_SOCRATIC = 'csat_analytics_socratic_v1';

/**
 * Get stored student activities from localStorage
 */
export function getStoredStudentActivities(): StudentActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get stored Socratic conversation summaries from localStorage
 */
export function getStoredSocraticSummaries(): SocraticSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOCRATIC);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Record user login event and update dwell time & login counts
 */
export function recordUserLogin(user: { email?: string | null; displayName?: string | null; photoURL?: string | null }): StudentActivity[] {
  if (!user || !user.email) return getStoredStudentActivities();

  const students = getStoredStudentActivities();
  const cleanEmail = user.email.trim().toLowerCase();
  const nowStr = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const existingIndex = students.findIndex((s) => s.email.toLowerCase() === cleanEmail);

  if (existingIndex >= 0) {
    students[existingIndex] = {
      ...students[existingIndex],
      name: user.displayName || students[existingIndex].name || cleanEmail.split('@')[0],
      avatarUrl: user.photoURL || students[existingIndex].avatarUrl,
      loginCount: students[existingIndex].loginCount + 1,
      lastLogin: nowStr,
      status: 'online',
    };
  } else {
    students.unshift({
      id: `std-${Date.now()}`,
      email: cleanEmail,
      name: user.displayName || cleanEmail.split('@')[0],
      avatarUrl: user.photoURL || undefined,
      loginCount: 1,
      lastLogin: nowStr,
      totalDwellTimeMinutes: 5,
      completedPassagesCount: 0,
      transformedQuestionsGenerated: 0,
      quizAccuracyPercentage: 100,
      socraticQuestionsCount: 0,
      status: 'online',
    });
  }

  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  } catch (e) {
    console.warn('Failed to save student login analytics:', e);
  }

  return students;
}

/**
 * Record Socratic tutor conversation event
 */
export function recordSocraticQuestion(data: {
  studentEmail?: string | null;
  studentName?: string | null;
  passageTitle: string;
  lesson: string;
  itemNo: string;
  questionText: string;
  hintLevel: number;
}): void {
  const email = data.studentEmail || '익명 학습자';
  const name = data.studentName || email.split('@')[0];
  const nowStr = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaries = getStoredSocraticSummaries();
  const status: '우수 (구문 파악 성공)' | '보통 (힌트 유도 필요)' | '집중 필요 (어휘 보강)' =
    data.hintLevel === 1 ? '우수 (구문 파악 성공)' : data.hintLevel === 2 ? '보통 (힌트 유도 필요)' : '집중 필요 (어휘 보강)';

  summaries.unshift({
    id: `soc-${Date.now()}`,
    studentEmail: email,
    studentName: name,
    passageTitle: data.passageTitle,
    lesson: data.lesson,
    itemNo: data.itemNo,
    timestamp: nowStr,
    studentQuestionSnippet: data.questionText.slice(0, 120),
    aiHintLevel: data.hintLevel,
    keyTopic: `${data.lesson} ${data.itemNo} 핵심 질의`,
    metacognitiveStatus: status,
  });

  try {
    localStorage.setItem(STORAGE_KEY_SOCRATIC, JSON.stringify(summaries.slice(0, 50)));
  } catch (e) {}

  // Update student socratic count
  if (data.studentEmail) {
    const students = getStoredStudentActivities();
    const idx = students.findIndex((s) => s.email.toLowerCase() === data.studentEmail?.toLowerCase());
    if (idx >= 0) {
      students[idx].socraticQuestionsCount += 1;
      students[idx].totalDwellTimeMinutes += 2;
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    }
  }
}

/**
 * Record transformed question generation event
 */
export function recordGeneratorUsage(studentEmail?: string | null): void {
  if (!studentEmail) return;
  const students = getStoredStudentActivities();
  const idx = students.findIndex((s) => s.email.toLowerCase() === studentEmail.toLowerCase());
  if (idx >= 0) {
    students[idx].transformedQuestionsGenerated += 1;
    students[idx].completedPassagesCount += 1;
    students[idx].totalDwellTimeMinutes += 5;
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    } catch (e) {}
  }
}

/**
 * Clear all accumulated analytics data
 */
export function clearAnalyticsData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_STUDENTS);
    localStorage.removeItem(STORAGE_KEY_SOCRATIC);
  } catch (e) {}
}

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
