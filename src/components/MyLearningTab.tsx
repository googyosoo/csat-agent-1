import React, { useState, useEffect } from 'react';
import { EBSPassage } from '../types';
import { getStoredLearningEvents, LearningEvent } from '../lib/analytics';
import { auth } from '../lib/firebase';

interface MyLearningTabProps {
  onSelectPassage: (passageId: string) => void;
  dataset: EBSPassage[];
}

export const MyLearningTab: React.FC<MyLearningTabProps> = ({ onSelectPassage, dataset }) => {
  const [events, setEvents] = useState<LearningEvent[]>([]);

  useEffect(() => {
    const allEvents = getStoredLearningEvents();
    if (auth.currentUser?.email) {
      setEvents(allEvents.filter((e) => e.studentEmail === auth.currentUser?.email));
    } else {
      setEvents(allEvents);
    }
  }, []);

  const quizEvents = events.filter((e) => e.eventType === 'SOLVE_QUIZ');
  const totalSolved = quizEvents.length;
  const correctCount = quizEvents.filter((e) => e.isCorrect).length;
  const accuracy = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;

  // Type Breakdown
  const typeMap: Record<string, { total: number; correct: number }> = {};
  quizEvents.forEach((e) => {
    const t = e.questionType || '기타';
    if (!typeMap[t]) typeMap[t] = { total: 0, correct: 0 };
    typeMap[t].total += 1;
    if (e.isCorrect) typeMap[t].correct += 1;
  });

  const wrongEvents = quizEvents.filter((e) => e.isCorrect === false);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-slate-900 p-6 rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs mb-1">
            <i className="fa-solid fa-sparkles"></i>
            <span>S5 개인화 맞춤학습 & AI 오답노트</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">
            {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '학습자'} 님의 수능 독해 약점 분석 리포트
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            누적 학습 데이터 기반 오답률 분석 및 생기부 세특 자산 축적현황입니다.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold block">누적 문제 풀이</span>
            <span className="text-lg font-bold text-blue-400 font-mono">{totalSolved}문항</span>
          </div>
          <div className="bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold block">정답률</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{accuracy}%</span>
          </div>
        </div>
      </div>

      {/* Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Type Breakdown & Recommendations */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 flex items-center space-x-2 border-b border-slate-800 pb-3">
              <i className="fa-solid fa-chart-pie text-cyan-400"></i>
              <span>유형별 정답률 및 취약점 분석</span>
            </h3>

            {Object.keys(typeMap).length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-1">
                <i className="fa-solid fa-list-check text-2xl text-slate-600"></i>
                <p className="text-xs font-semibold">아직 풀이한 문제 데이터가 없습니다.</p>
                <p className="text-[11px]">워크북이나 변형문제 생성기에서 문제를 풀어보세요!</p>
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

          {/* AI Weakness Recommendation Badge */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-2">
            <h4 className="text-xs font-bold text-amber-400 flex items-center space-x-2">
              <i className="fa-solid fa-lightbulb"></i>
              <span>AI 맞춤 학습 큐레이션 추천</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              현재 분석 결과, <strong>빈칸 추론 및 어법성 판단</strong> 유형의 접속어 맥락 파악에 집중 보강이 권장됩니다.
            </p>
          </div>
        </div>

        {/* Right: Wrong Answer Journal (S5 오답노트) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-rose-400 flex items-center space-x-2">
                <i className="fa-solid fa-book-bookmark"></i>
                <span>나만의 개인 오답노트 (Wrong Answer Journal) ({wrongEvents.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">자동 복습 족보</span>
            </div>

            {wrongEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <i className="fa-solid fa-circle-check text-4xl text-emerald-400/50"></i>
                <p className="text-xs font-bold text-slate-300">오답이 없습니다! 모든 퀴즈를 완벽하게 통과하셨습니다.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {wrongEvents.map((item, idx) => {
                  const passage = dataset.find((p) => p.id === item.passageId);
                  return (
                    <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-rose-950/60 hover:border-rose-700/50 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20">
                          [{item.lesson} {item.itemNo}] {item.questionType}
                        </span>
                        <button
                          onClick={() => onSelectPassage(item.passageId)}
                          className="text-[11px] text-blue-400 hover:underline font-bold flex items-center space-x-1"
                        >
                          <span>지문 복습하기</span>
                          <i className="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2">
                        {passage?.title || 'EBS 수능 연계 지문'}
                      </p>

                      {item.reasonText && (
                        <div className="p-2.5 bg-slate-900/80 rounded-lg text-[11px] text-amber-300 border border-amber-500/20 font-serif leading-relaxed">
                          💡 <strong>정답 논리:</strong> {item.reasonText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
