import React, { useState, useEffect } from 'react';
import { User } from '../lib/firebase';
import { EBSPassage } from '../types';
import {
  StudentActivity,
  SocraticSummary,
  StudentReflection,
  LearningEvent,
  fetchFirestoreStudentActivities,
  fetchFirestoreSocraticSummaries,
  fetchFirestoreStudentReflections,
  getStoredLearningEvents,
  getStoredStudentActivities,
} from '../lib/analytics';
import { safeFetchJson } from '../lib/api';

interface StudentDashboardTabProps {
  authUser: User | null;
  dataset: EBSPassage[];
  onSelectPassage?: (passageId: string) => void;
}

export const StudentDashboardTab: React.FC<StudentDashboardTabProps> = ({
  authUser,
  dataset,
  onSelectPassage,
}) => {
  const currentEmail = (authUser?.email || 'student@simin.hs.kr').toLowerCase();
  const currentName = authUser?.displayName || currentEmail.split('@')[0] || '학습자';

  const [myActivity, setMyActivity] = useState<StudentActivity | null>(null);
  const [mySocraticLogs, setMySocraticLogs] = useState<SocraticSummary[]>([]);
  const [myReflections, setMyReflections] = useState<StudentReflection[]>([]);
  const [myEvents, setMyEvents] = useState<LearningEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyData();
  }, [currentEmail]);

  const loadMyData = async () => {
    setIsLoading(true);
    try {
      const [allStudents, allSocratic, allReflections] = await Promise.allSettled([
        fetchFirestoreStudentActivities(),
        fetchFirestoreSocraticSummaries(),
        fetchFirestoreStudentReflections(),
      ]);

      const studentList = allStudents.status === 'fulfilled' ? allStudents.value : getStoredStudentActivities();
      const foundStudent = studentList.find((s) => s.email.toLowerCase() === currentEmail);

      const socList = allSocratic.status === 'fulfilled' ? allSocratic.value : [];
      const refList = allReflections.status === 'fulfilled' ? allReflections.value : [];

      setMyActivity(
        foundStudent || {
          id: `std-local-${Date.now()}`,
          email: currentEmail,
          name: currentName,
          loginCount: 1,
          lastLogin: new Date().toLocaleString('ko-KR'),
          totalDwellTimeMinutes: 5,
          completedPassagesCount: 0,
          transformedQuestionsGenerated: 0,
          quizAccuracyPercentage: 100,
          socraticQuestionsCount: 0,
          status: 'online',
        }
      );

      setMySocraticLogs(socList.filter((s) => s.studentEmail.toLowerCase() === currentEmail));
      setMyReflections(refList.filter((r) => r.studentEmail.toLowerCase() === currentEmail));

      const localEvents = getStoredLearningEvents();
      setMyEvents(localEvents.filter((e) => e.studentEmail?.toLowerCase() === currentEmail));
    } catch (e) {
      console.warn('[StudentDashboard] Error loading my data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Quiz Statistics
  const quizEvents = myEvents.filter((e) => e.eventType === 'SOLVE_QUIZ');
  const totalSolved = quizEvents.length;
  const correctCount = quizEvents.filter((e) => e.isCorrect).length;
  const accuracy = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 100;
  const wrongEvents = quizEvents.filter((e) => e.isCorrect === false);

  // Question Type Breakdown
  const typeMap: Record<string, { total: number; correct: number }> = {};
  quizEvents.forEach((e) => {
    const t = e.questionType || '기타';
    if (!typeMap[t]) typeMap[t] = { total: 0, correct: 0 };
    typeMap[t].total += 1;
    if (e.isCorrect) typeMap[t].correct += 1;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          {authUser?.photoURL ? (
            <img
              src={authUser.photoURL}
              alt={currentName}
              className="w-14 h-14 rounded-2xl border-2 border-blue-400 shadow-md object-cover no-invert"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center border-2 border-blue-400 shadow-md">
              {currentName[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-extrabold text-white">{currentName} 학생의 개인 학습 대시보드</h2>
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold rounded-md">
                STUDENT PROFILE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-mono">{currentEmail}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              최근 접속: {myActivity?.lastLogin || '방금 전'} | 누적 로그인: {myActivity?.loginCount || 1}회
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">내 학습 체류 시간</span>
            <i className="fa-solid fa-clock text-amber-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{myActivity?.totalDwellTimeMinutes || 0}</span>
            <span className="text-xs text-amber-400 font-semibold">분</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">완료한 EBS 지문</span>
            <i className="fa-solid fa-book-open text-purple-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{myActivity?.completedPassagesCount || 0}</span>
            <span className="text-xs text-purple-400 font-semibold">지문</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">변형문제 풀이 / 정답률</span>
            <i className="fa-solid fa-file-pen text-emerald-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{totalSolved > 0 ? totalSolved : (myActivity?.transformedQuestionsGenerated || 0)}</span>
            <span className="text-xs text-slate-400">건</span>
            <span className="text-xs text-emerald-400 font-bold ml-auto font-mono">({accuracy}%)</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">소크라테스 질의</span>
            <i className="fa-solid fa-comments text-rose-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{mySocraticLogs.length || myActivity?.socraticQuestionsCount || 0}</span>
            <span className="text-xs text-rose-400 font-semibold">건</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Weakness Analysis */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 flex items-center space-x-2 border-b border-slate-800 pb-3">
              <i className="fa-solid fa-chart-pie text-cyan-400"></i>
              <span>내 문항 유형별 정답률 분석</span>
            </h3>

            {Object.keys(typeMap).length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-1">
                <i className="fa-solid fa-list-check text-2xl text-slate-600 mb-1"></i>
                <p className="text-xs font-semibold text-slate-400">풀이 이력이 아직 충분하지 않습니다.</p>
                <p className="text-[11px] text-slate-500">변형문제 생성기에서 퀴즈를 풀면 정답률이 집계됩니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(typeMap).map(([type, stat]) => {
                  const rate = Math.round((stat.correct / stat.total) * 100);
                  let barColor = 'bg-emerald-500';
                  if (rate < 60) barColor = 'bg-rose-500';
                  else if (rate < 80) barColor = 'bg-amber-500';

                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">{type}</span>
                        <span className="text-slate-400 font-mono">
                          {stat.correct}/{stat.total} ({rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Socratic Log History */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-rose-400 flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center space-x-2">
                <i className="fa-solid fa-brain"></i>
                <span>내 소크라테스 튜터 질의 이력</span>
              </span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-mono">
                {mySocraticLogs.length}건
              </span>
            </h3>

            {mySocraticLogs.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                소크라테스 탭에서 AI 튜터와 나눈 질문 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {mySocraticLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-slate-200">[{log.lesson} {log.itemNo}] {log.passageTitle}</span>
                      <span className="text-[10px] text-purple-400 font-mono">{log.metacognitiveStatus}</span>
                    </div>
                    <p className="text-slate-300 italic text-[11px]">"{log.studentQuestionSnippet}"</p>
                    <div className="text-[10px] text-slate-500 text-right font-mono">{log.timestamp}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Wrong Answer Journal & My Reflections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wrong Answer Journal */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-rose-400 flex items-center space-x-2">
                <i className="fa-solid fa-book-bookmark"></i>
                <span>나만의 개인 오답노트 ({wrongEvents.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">자동 복습 족보</span>
            </div>

            {wrongEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <i className="fa-solid fa-circle-check text-3xl text-emerald-400/50"></i>
                <p className="text-xs font-bold text-slate-300">오답이 없습니다! 풀이한 문제들을 완벽하게 이해하셨습니다.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {wrongEvents.map((item, idx) => {
                  const passage = dataset.find((p) => p.id === item.passageId);
                  return (
                    <div key={idx} className="p-3.5 bg-slate-950 rounded-xl border border-rose-950/60 hover:border-rose-700/50 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          [{item.lesson} {item.itemNo}] {item.questionType}
                        </span>
                        {onSelectPassage && (
                          <button
                            onClick={() => onSelectPassage(item.passageId)}
                            className="text-[11px] text-blue-400 hover:underline font-bold flex items-center space-x-1"
                          >
                            <span>지문 복습하기</span>
                            <i className="fa-solid fa-arrow-right text-[10px]"></i>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 font-medium">
                        {passage?.title || 'EBS 수능 연계 지문'}
                      </p>

                      {item.reasonText && (
                        <div className="p-2 bg-slate-900/80 rounded-lg text-[11px] text-amber-300 border border-amber-500/20 font-serif leading-relaxed">
                          💡 <strong>정답 해설:</strong> {item.reasonText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Reflections List */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-purple-300 flex items-center space-x-2">
                <i className="fa-solid fa-pen-fancy"></i>
                <span>내가 제출한 메타인지 성찰 소감 기록 ({myReflections.length}건)</span>
              </h3>
            </div>

            {myReflections.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                지문분석 워크북 탭에서 학습 소감을 제출하면 이곳에 기록됩니다.
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {myReflections.map((ref) => (
                  <div key={ref.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200">📌 {ref.passageTitle}</span>
                      <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded text-[10px] font-mono">
                        {ref.lesson} {ref.itemNo}
                      </span>
                    </div>
                    <p className="text-xs text-purple-200 font-serif italic bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/30">
                      "{ref.reflectionText}"
                    </p>
                    <div className="text-[10px] text-slate-500 text-right font-mono">{ref.timestamp}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
