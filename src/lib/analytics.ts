/**
 * Real-time Student Analytics & Learning Tracking Engine with Firebase Firestore & LocalStorage Persistence
 */

import { db } from './firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

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
 * Get stored student activities from localStorage (or Firestore fallback)
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
 * Async fetch student activities from Firebase Firestore with LocalStorage fallback
 */
export async function fetchFirestoreStudentActivities(): Promise<StudentActivity[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'students'));
    if (querySnapshot.empty) {
      return getStoredStudentActivities();
    }
    const list: StudentActivity[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as StudentActivity);
    });
    return list;
  } catch (e) {
    return getStoredStudentActivities();
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
 * Async fetch Socratic summaries from Firebase Firestore
 */
export async function fetchFirestoreSocraticSummaries(): Promise<SocraticSummary[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'socratic_logs'));
    if (querySnapshot.empty) {
      return getStoredSocraticSummaries();
    }
    const list: SocraticSummary[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as SocraticSummary);
    });
    return list;
  } catch (e) {
    return getStoredSocraticSummaries();
  }
}

/**
 * Record user login event and save to Firestore & LocalStorage
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
  let updatedRecord: StudentActivity;

  if (existingIndex >= 0) {
    updatedRecord = {
      ...students[existingIndex],
      name: user.displayName || students[existingIndex].name || cleanEmail.split('@')[0],
      avatarUrl: user.photoURL || students[existingIndex].avatarUrl,
      loginCount: students[existingIndex].loginCount + 1,
      lastLogin: nowStr,
      status: 'online',
    };
    students[existingIndex] = updatedRecord;
  } else {
    updatedRecord = {
      id: `std-${Date.now()}`,
      email: cleanEmail,
      name: user.displayName || cleanEmail.split('@')[0],
      avatarUrl: user.photoURL || undefined,
      loginCount: 1,
      lastLogin: nowStr,
      totalDwellTimeMinutes: 10,
      completedPassagesCount: 1,
      transformedQuestionsGenerated: 0,
      quizAccuracyPercentage: 100,
      socraticQuestionsCount: 0,
      status: 'online',
    };
    students.unshift(updatedRecord);
  }

  // LocalStorage save
  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  } catch (e) {}

  // Firestore DB save (async background)
  try {
    const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    setDoc(doc(db, 'students', docId), updatedRecord, { merge: true }).catch(() => {});
  } catch (e) {}

  return students;
}

/**
 * Record Socratic tutor conversation event in Firestore & LocalStorage
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

  // Firestore DB save
  try {
    setDoc(doc(db, 'socratic_logs', newLog.id), newLog).catch(() => {});
  } catch (e) {}

  // Update student activity count
  if (data.studentEmail) {
    const students = getStoredStudentActivities();
    const idx = students.findIndex((s) => s.email.toLowerCase() === data.studentEmail?.toLowerCase());
    if (idx >= 0) {
      students[idx].socraticQuestionsCount += 1;
      students[idx].totalDwellTimeMinutes += 2;
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
      const docId = data.studentEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
    }
  }
}

/**
 * Record transformed question generation event in Firestore & LocalStorage
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
      const docId = studentEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
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
 * Record Student Passage Reflection in Firestore & LocalStorage
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
  const email = data.studentEmail || 'student@simin.hs.kr';
  const name = data.studentName || email.split('@')[0];
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

  // Firestore DB save
  try {
    setDoc(doc(db, 'student_reflections', newReflection.id), newReflection).catch(() => {});
  } catch (e) {}

  // Update student completed passages count
  if (data.studentEmail) {
    const students = getStoredStudentActivities();
    const idx = students.findIndex((s) => s.email.toLowerCase() === data.studentEmail?.toLowerCase());
    if (idx >= 0) {
      students[idx].completedPassagesCount += 1;
      students[idx].totalDwellTimeMinutes += 3;
      try {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
        const docId = data.studentEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        setDoc(doc(db, 'students', docId), students[idx], { merge: true }).catch(() => {});
      } catch (e) {}
    }
  }

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
 * Async fetch student reflections from Firebase Firestore with LocalStorage fallback
 */
export async function fetchFirestoreStudentReflections(): Promise<StudentReflection[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'student_reflections'));
    if (querySnapshot.empty) {
      return getStoredStudentReflections();
    }
    const list: StudentReflection[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as StudentReflection);
    });
    return list;
  } catch (e) {
    return getStoredStudentReflections();
  }
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
