/**
 * Real-time Student Analytics & Learning Tracking Engine with Firebase Firestore & LocalStorage Persistence
 */

import { db } from './firebase';
import { collection, doc, setDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { safeFetchJson } from './api';

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

export interface StudentReflection {
  id: string;
  studentEmail: string;
  studentName: string;
  passageId: string;
  lesson: string;
  itemNo: string;
  passageTitle: string;
  reflectionText: string;
  timestamp: string;
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
const STORAGE_KEY_REFLECTIONS = 'csat_analytics_reflections_v1';

/**
 * Helper to sync student data to Central Server API
 */
function syncStudentToServer(student: StudentActivity): void {
  try {
    safeFetchJson('/api/analytics/sync-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    }).catch((err) => {
      console.warn('[syncStudentToServer Failed]:', err);
    });
  } catch (e) {}
}

/**
 * Get stored student activities from localStorage (filters out dummy accounts)
 */
export function getStoredStudentActivities(): StudentActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => s.email && s.email.toLowerCase() !== 'student@simin.hs.kr');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Async fetch student activities with 3-tier fallback: Firestore -> Server API -> LocalStorage
 */
export async function fetchFirestoreStudentActivities(): Promise<StudentActivity[]> {
  // 1. Try Firestore
  try {
    const firestorePromise = getDocs(collection(db, 'students'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 2000)
    );
    const querySnapshot = await Promise.race([firestorePromise, timeoutPromise]);
    if (!querySnapshot.empty) {
      const list: StudentActivity[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as StudentActivity);
      });
      return list;
    }
  } catch (e) {
    console.warn('[fetchFirestoreStudentActivities] Firestore failed, trying Central Server API:', e);
  }

  // 2. Try Central Server API
  try {
    const res = await safeFetchJson('/api/analytics/students');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn('[fetchFirestoreStudentActivities] Server API failed, falling back to LocalStorage:', e);
  }

  // 3. Fallback to LocalStorage
  return getStoredStudentActivities();
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
 * Async fetch Socratic summaries with 3-tier fallback: Firestore -> Server API -> LocalStorage
 */
export async function fetchFirestoreSocraticSummaries(): Promise<SocraticSummary[]> {
  // 1. Try Firestore
  try {
    const firestorePromise = getDocs(collection(db, 'socratic_logs'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 2000)
    );
    const querySnapshot = await Promise.race([firestorePromise, timeoutPromise]);
    if (!querySnapshot.empty) {
      const list: SocraticSummary[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as SocraticSummary);
      });
      return list;
    }
  } catch (e) {
    console.warn('[fetchFirestoreSocraticSummaries] Firestore failed, trying Central Server API:', e);
  }

  // 2. Try Central Server API
  try {
    const res = await safeFetchJson('/api/analytics/socratic-logs');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn('[fetchFirestoreSocraticSummaries] Server API failed, falling back to LocalStorage:', e);
  }

  // 3. Fallback to LocalStorage
  return getStoredSocraticSummaries();
}

/**
 * Helper to ensure student activity record exists in LocalStorage and Firestore
 */
function ensureStudentExists(emailInput?: string | null, nameInput?: string | null): { students: StudentActivity[]; idx: number } {
  const currentAuthEmail = auth.currentUser?.email;
  const currentAuthName = auth.currentUser?.displayName;

  const email = (emailInput && emailInput.trim().length > 0 && emailInput !== 'anonymous')
    ? emailInput.trim().toLowerCase()
    : (currentAuthEmail ? currentAuthEmail.trim().toLowerCase() : 'english1@simin.hs.kr');

  const name = (nameInput && nameInput.trim().length > 0)
    ? nameInput.trim()
    : (currentAuthName || email.split('@')[0] || '학습자');

  const students = getStoredStudentActivities();
  let idx = students.findIndex((s) => s.email.toLowerCase() === email);

  const nowStr = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (idx < 0) {
    const newStudent: StudentActivity = {
      id: `std-${Date.now()}`,
      email,
      name,
      loginCount: 1,
      lastLogin: nowStr,
      totalDwellTimeMinutes: 5,
      completedPassagesCount: 0,
      transformedQuestionsGenerated: 0,
      quizAccuracyPercentage: 100,
      socraticQuestionsCount: 0,
      status: 'online',
    };
    students.unshift(newStudent);
    idx = 0;
  } else {
    students[idx].lastLogin = nowStr;
    students[idx].status = 'online';
    if (nameInput && nameInput !== students[idx].name) {
      students[idx].name = nameInput;
    }
  }

  return { students, idx };
}

/**
 * Record user login event and save to Firestore, Server API & LocalStorage
 */
export function recordUserLogin(user: { email?: string | null; displayName?: string | null; photoURL?: string | null }): StudentActivity[] {
  const email = user?.email || auth.currentUser?.email || 'english1@simin.hs.kr';
  const name = user?.displayName || auth.currentUser?.displayName || email.split('@')[0];

  const { students, idx } = ensureStudentExists(email, name);
  students[idx].loginCount = (students[idx].loginCount || 0) + 1;
  if (user?.photoURL) {
    students[idx].avatarUrl = user.photoURL;
  }

  // 1. LocalStorage save
  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  } catch (e) {}

  // 2. Central Server API save
  syncStudentToServer(students[idx]);

  // 3. Firestore DB save (async background)
  try {
    const docId = students[idx].email.replace(/[^a-zA-Z0-9]/g, '_');
    setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
  } catch (e) {}

  return students;
}

/**
 * Record Socratic tutor conversation event in Firestore, Server API & LocalStorage
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
  const email = data.studentEmail || auth.currentUser?.email || 'english1@simin.hs.kr';
  const name = data.studentName || auth.currentUser?.displayName || email.split('@')[0];
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

  const newLog: SocraticSummary = {
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
  };

  summaries.unshift(newLog);

  try {
    localStorage.setItem(STORAGE_KEY_SOCRATIC, JSON.stringify(summaries.slice(0, 50)));
  } catch (e) {}

  // Central Server API save
  try {
    safeFetchJson('/api/analytics/socratic-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});
  } catch (e) {}

  // Firestore DB save
  try {
    setDoc(doc(db, 'socratic_logs', newLog.id), newLog).catch(() => {});
  } catch (e) {}

  // Update student activity count (auto-create student if missing)
  const { students, idx } = ensureStudentExists(email, name);
  students[idx].socraticQuestionsCount = (students[idx].socraticQuestionsCount || 0) + 1;
  students[idx].totalDwellTimeMinutes = (students[idx].totalDwellTimeMinutes || 0) + 2;

  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    syncStudentToServer(students[idx]);
    const docId = students[idx].email.replace(/[^a-zA-Z0-9]/g, '_');
    setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
  } catch (e) {}
}

/**
 * Record transformed question generation event in Firestore, Server API & LocalStorage
 */
export function recordGeneratorUsage(studentEmail?: string | null, studentName?: string | null): void {
  const email = studentEmail || auth.currentUser?.email || 'english1@simin.hs.kr';
  const name = studentName || auth.currentUser?.displayName || email.split('@')[0];

  const { students, idx } = ensureStudentExists(email, name);
  students[idx].transformedQuestionsGenerated = (students[idx].transformedQuestionsGenerated || 0) + 1;
  students[idx].completedPassagesCount = (students[idx].completedPassagesCount || 0) + 1;
  students[idx].totalDwellTimeMinutes = (students[idx].totalDwellTimeMinutes || 0) + 5;

  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    syncStudentToServer(students[idx]);
    const docId = students[idx].email.replace(/[^a-zA-Z0-9]/g, '_');
    setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
  } catch (e) {}
}

/**
 * Clear all accumulated analytics data
 */
export function clearAnalyticsData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_STUDENTS);
    localStorage.removeItem(STORAGE_KEY_SOCRATIC);
    localStorage.removeItem(STORAGE_KEY_REFLECTIONS);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
  } catch (e) {}
}

/**
 * Record Student Passage Reflection in Firestore, Server API & LocalStorage
 */
export function recordStudentReflection(data: {
  studentEmail?: string | null;
  studentName?: string | null;
  passageId: string;
  lesson: string;
  itemNo: string;
  passageTitle: string;
  reflectionText: string;
}): StudentReflection {
  const email = data.studentEmail || auth.currentUser?.email || 'english1@simin.hs.kr';
  const name = data.studentName || auth.currentUser?.displayName || email.split('@')[0];
  const nowStr = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const reflections = getStoredStudentReflections();
  const newReflection: StudentReflection = {
    id: `ref-${Date.now()}`,
    studentEmail: email,
    studentName: name,
    passageId: data.passageId,
    lesson: data.lesson,
    itemNo: data.itemNo,
    passageTitle: data.passageTitle,
    reflectionText: data.reflectionText.trim(),
    timestamp: nowStr,
  };

  reflections.unshift(newReflection);

  try {
    localStorage.setItem(STORAGE_KEY_REFLECTIONS, JSON.stringify(reflections));
  } catch (e) {}

  // Central Server API save
  try {
    safeFetchJson('/api/analytics/reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReflection),
    }).catch(() => {});
  } catch (e) {}

  // Firestore DB save
  try {
    setDoc(doc(db, 'student_reflections', newReflection.id), newReflection).catch(() => {});
  } catch (e) {}

  // Update student completed passages count (auto-create student if missing)
  const { students, idx } = ensureStudentExists(email, name);
  students[idx].completedPassagesCount = (students[idx].completedPassagesCount || 0) + 1;
  students[idx].totalDwellTimeMinutes = (students[idx].totalDwellTimeMinutes || 0) + 3;

  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    syncStudentToServer(students[idx]);
    const docId = students[idx].email.replace(/[^a-zA-Z0-9]/g, '_');
    setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
  } catch (e) {}

  return newReflection;
}

/**
 * Get stored student reflections from LocalStorage
 */
export function getStoredStudentReflections(): StudentReflection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REFLECTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Async fetch student reflections with 3-tier fallback: Firestore -> Server API -> LocalStorage
 */
export async function fetchFirestoreStudentReflections(): Promise<StudentReflection[]> {
  // 1. Try Firestore
  try {
    const firestorePromise = getDocs(collection(db, 'student_reflections'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 2000)
    );
    const querySnapshot = await Promise.race([firestorePromise, timeoutPromise]);
    if (!querySnapshot.empty) {
      const list: StudentReflection[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as StudentReflection);
      });
      return list;
    }
  } catch (e) {
    console.warn('[fetchFirestoreStudentReflections] Firestore failed, trying Central Server API:', e);
  }

  // 2. Try Central Server API
  try {
    const res = await safeFetchJson('/api/analytics/reflections');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn('[fetchFirestoreStudentReflections] Server API failed, falling back to LocalStorage:', e);
  }

  // 3. Fallback to LocalStorage
  return getStoredStudentReflections();
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

/**
 * Phase 1 S1: Append-only Event Logging for Student Learning Analytics
 */
export interface LearningEvent {
  studentEmail: string;
  studentName?: string;
  subject: '진로영어' | '심화영어II';
  passageId: string;
  lesson: string;
  itemNo: string;
  eventType: 'SOLVE_QUIZ' | 'SOCRATIC_QUESTION' | 'STUDENT_REFLECTION' | 'GENERATE_QUESTION';
  questionType?: string;
  difficulty?: string;
  selectedIndex?: number;
  correctIndex?: number;
  isCorrect?: boolean;
  reasonText?: string; // 학생이 작성한 정답/생각 근거 (세특 생기부 축적 자산)
  elapsedMs?: number;
  tutorTurns?: number;
  hintLevelUsed?: number;
  createdAt?: string;
}

const STORAGE_KEY_EVENTS = 'csat_learning_events_v1';

export async function recordLearningEvent(event: Omit<LearningEvent, 'createdAt'>): Promise<void> {
  const payload = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  // 1. Save to LocalStorage append-only array
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    const list: LearningEvent[] = raw ? JSON.parse(raw) : [];
    list.unshift(payload);
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(list.slice(0, 100)));
  } catch (err) {
    console.warn('[LocalStorage recordLearningEvent Failed]:', err);
  }

  // 2. Append to Firestore `events` collection
  try {
    await addDoc(collection(db, 'events'), {
      ...event,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore recordLearningEvent Failed]:', err);
  }
}

export function getStoredLearningEvents(): LearningEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
