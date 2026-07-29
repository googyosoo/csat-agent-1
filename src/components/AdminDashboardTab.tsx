import React, { useState } from 'react';
import { User } from '../lib/firebase';
import { isAdminUser, ADMIN_EMAILS } from '../lib/adminAuth';
import {
  StudentActivity,
  SocraticSummary,
  INITIAL_STUDENT_ACTIVITIES,
  INITIAL_SOCRATIC_SUMMARIES,
  calculateAnalyticsMetrics,
} from '../lib/analytics';

interface AdminDashboardTabProps {
  authUser: User | null;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ authUser }) => {
  const [students] = useState<StudentActivity[]>(INITIAL_STUDENT_ACTIVITIES);
  const [socSummaries] = useState<SocraticSummary[]>(INITIAL_SOCRATIC_SUMMARIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentActivity | null>(null);

  // Check admin authorization
  const isRealAdmin = authUser ? isAdminUser(authUser.email) : false;
  const [previewMode, setPreviewMode] = useState<boolean>(true); // Allowed for demonstration

  const hasAccess = isRealAdmin || previewMode;
  const metrics = calculateAnalyticsMetrics(students);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mx-auto font-bold border border-rose-500/30">
          <i className="fa-solid fa-user-lock"></i>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">학습 관리자 접근 제한 구역</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          이 대시보드는 지정된 수능 영어 교사 및 관리자 계정만 접근할 수 있습니다.
          <br />
          허가된 관리자 계정: <span className="text-cyan-300 font-mono">{ADMIN_EMAILS.join(', ')}</span>
        </p>
        <button
          onClick={() => setPreviewMode(true)}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all"
        >
          관리자 뷰 미리보기 (테스트용)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xl font-bold">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white">2027 진로영어 학습자 분석 대시보드</h2>
              <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold rounded-md">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              학생별 로그인 횟수, 체류 시간, 소크라테스 질의응답 및 수능 변형문제 학습 현황 시각화
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              접속 계정:{' '}
              <strong className="text-emerald-300 font-mono">
                {authUser?.email || (previewMode ? '관리자 뷰 미리보기 모드' : 'kiparang999@gmail.com')}
              </strong>
            </span>
          </div>
          {!isRealAdmin && (
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all shrink-0"
            >
              {previewMode ? '미리보기 끄기' : '미리보기 켜기'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Top Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">수강 학생 수</span>
            <i className="fa-solid fa-users text-purple-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalStudents}</span>
            <span className="text-xs text-emerald-400 font-semibold">명 등록</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">총 로그인 횟수</span>
            <i className="fa-solid fa-key text-cyan-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalLogins}</span>
            <span className="text-xs text-cyan-400 font-semibold">회 접속</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">평균 체류 시간</span>
            <i className="fa-solid fa-clock text-amber-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.avgDwellTimeMinutes}</span>
            <span className="text-xs text-amber-400 font-semibold">분/학생</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">변형문제 생성</span>
            <i className="fa-solid fa-file-pen text-emerald-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalGeneratedQuestions}</span>
            <span className="text-xs text-emerald-400 font-semibold">문항 완료</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">소크라테스 질의</span>
            <i className="fa-solid fa-comments text-rose-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalSocraticConversations}</span>
            <span className="text-xs text-rose-400 font-semibold">건 대화</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: EBS Lesson Progress Bar Gauge */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <i className="fa-solid fa-chart-simple text-purple-400"></i>
              <span>EBS 강별 학습 진도율</span>
            </h3>
            <span className="text-[10px] text-slate-400">08강 ~ 12강</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {[
              { lesson: '08강 지문', progress: 92, count: '14/15명 완료', color: 'from-purple-500 to-indigo-500' },
              { lesson: '09강 지문', progress: 85, count: '13/15명 완료', color: 'from-cyan-500 to-blue-500' },
              { lesson: '10강 지문', progress: 78, count: '11/15명 완료', color: 'from-emerald-500 to-teal-500' },
              { lesson: '11강 지문', progress: 64, count: '9/15명 완료', color: 'from-amber-500 to-orange-500' },
              { lesson: '12강 지문', progress: 48, count: '7/15명 완료', color: 'from-rose-500 to-pink-500' },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{item.lesson}</span>
                  <span className="text-slate-400 text-[11px]">{item.progress}% ({item.count})</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Hourly Dwell Time SVG Trend Chart */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <i className="fa-solid fa-chart-line text-cyan-400"></i>
              <span>시간대별 학생 평균 체류 시간 추이</span>
            </h3>
            <span className="text-[10px] text-cyan-300 font-mono">분 단위</span>
          </div>

          <div className="pt-2 flex flex-col justify-between h-48">
            <svg viewBox="0 0 300 120" className="w-full h-36 overflow-visible">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Background horizontal grid */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="300" y2="100" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />

              {/* Area path */}
              <path
                d="M 10,95 Q 60,30 110,65 T 210,25 T 290,55 L 290,110 L 10,110 Z"
                fill="url(#areaGrad)"
              />
              {/* Line path */}
              <path
                d="M 10,95 Q 60,30 110,65 T 210,25 T 290,55"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Points */}
              <circle cx="10" cy="95" r="4" fill="#38bdf8" />
              <circle cx="60" cy="30" r="4" fill="#38bdf8" />
              <circle cx="110" cy="65" r="4" fill="#38bdf8" />
              <circle cx="160" cy="45" r="4" fill="#38bdf8" />
              <circle cx="210" cy="25" r="4" fill="#38bdf8" />
              <circle cx="290" cy="55" r="4" fill="#38bdf8" />
            </svg>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>23:00</span>
            </div>
          </div>
        </div>

        {/* Chart 3: Question Type Accuracy Donut & Bars */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <i className="fa-solid fa-bullseye text-emerald-400"></i>
              <span>수능 변형문제 유형별 정답률</span>
            </h3>
            <span className="text-[10px] text-emerald-300 font-mono">평균 87.1%</span>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { type: '주제 및 제목', accuracy: 94, isWeak: false },
              { type: '어휘 적절성', accuracy: 88, isWeak: false },
              { type: '요약문 완성', accuracy: 85, isWeak: false },
              { type: '어법성 판단', accuracy: 78, isWeak: true },
              { type: '빈칸 추론 / 순서삽입', accuracy: 72, isWeak: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300 w-28 truncate">{item.type}</span>
                <div className="flex-1 mx-3 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      item.isWeak ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${item.accuracy}%` }}
                  ></div>
                </div>
                <span className={`text-[11px] font-bold font-mono ${item.isWeak ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {item.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Student Analytics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-users-viewfinder text-purple-400"></i>
            <h3 className="text-xs font-bold text-white">학생별 세부 학습 활동 기록</h3>
            <span className="text-[10px] text-slate-400">({filteredStudents.length}명 검색됨)</span>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="학생 이름 또는 이메일 검색..."
              className="w-full bg-slate-950 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-purple-500"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-xs text-slate-500"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">상태</th>
                <th className="py-2.5 px-3">학생 정보</th>
                <th className="py-2.5 px-3">최근 접속 시각</th>
                <th className="py-2.5 px-3">총 체류 시간</th>
                <th className="py-2.5 px-3">완료 지문</th>
                <th className="py-2.5 px-3">변형문제 생성</th>
                <th className="py-2.5 px-3">퀴즈 정답률</th>
                <th className="py-2.5 px-3 text-right">상세 분석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredStudents.map((std) => (
                <tr key={std.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        std.status === 'online'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          std.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      ></span>
                      {std.status === 'online' ? '접속 중' : '오프라인'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div>
                      <div className="font-bold text-slate-200">{std.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{std.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">{std.lastLogin}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-amber-300 font-mono">{std.totalDwellTimeMinutes}</span> 분
                    <span className="text-[10px] text-slate-500 ml-1">({std.loginCount}회 접속)</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-purple-300 font-mono">{std.completedPassagesCount} 지문</td>
                  <td className="py-3 px-3 font-bold text-cyan-300 font-mono">{std.transformedQuestionsGenerated} 문제</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-emerald-400 font-mono">{std.quizAccuracyPercentage}%</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedStudent(std)}
                      className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-[11px] font-bold rounded-lg border border-purple-500/40 transition-all"
                    >
                      리포트
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Socratic Conversation Summary Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-brain text-emerald-400"></i>
            <h3 className="text-xs font-bold text-white">소크라테스 튜터 대화 요약 & 메타인지 분석 리포트</h3>
          </div>
          <span className="text-[10px] text-slate-400">실시간 질의응답 3단계 힌트 내역</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {socSummaries.map((soc) => (
            <div
              key={soc.id}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded">
                    {soc.lesson} {soc.itemNo}
                  </span>
                  <span className="text-xs font-bold text-white">{soc.studentName}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{soc.timestamp}</span>
              </div>

              <div className="text-xs font-semibold text-purple-300 flex items-center space-x-1">
                <i className="fa-solid fa-book-open text-[10px]"></i>
                <span className="truncate">{soc.passageTitle}</span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-serif italic">
                "{soc.studentQuestionSnippet}"
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-400">
                  핵심 주제: <strong className="text-slate-200">{soc.keyTopic}</strong>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    soc.metacognitiveStatus.includes('우수')
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : soc.metacognitiveStatus.includes('보통')
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {soc.metacognitiveStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <i className="fa-solid fa-address-card text-purple-400"></i>
                <span>[{selectedStudent.name}] 정밀 학습 성취도 리포트</span>
              </h3>
              <button onClick={() => setSelectedStudent(null)} className="text-slate-500 hover:text-slate-300">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">이메일</span>
                  <span className="font-bold text-slate-200 font-mono">{selectedStudent.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">최근 접속</span>
                  <span className="font-bold text-slate-200 font-mono">{selectedStudent.lastLogin}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">총 학습 체류 시간</span>
                  <span className="font-bold text-amber-300">{selectedStudent.totalDwellTimeMinutes}분</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">수능 변형문제 정답률</span>
                  <span className="font-bold text-emerald-400">{selectedStudent.quizAccuracyPercentage}%</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-300 mb-1">학습자 취약 구문 가이드:</h4>
                <p className="text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] leading-relaxed">
                  본 학생은 복합 관계대명사절 및 대조 연결어(However, On the other hand)가 결합된 지문에서
                  소크라테스 2단계 힌트 활용도가 높았으며, 어법 판단 문제의 정답률(78%)이 보강을 요합니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
