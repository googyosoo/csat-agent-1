import React, { useState, useEffect } from 'react';
import { User } from '../lib/firebase';
import { isAdminUser, ADMIN_EMAILS } from '../lib/adminAuth';
import {
  StudentActivity,
  SocraticSummary,
  getStoredStudentActivities,
  getStoredSocraticSummaries,
  calculateAnalyticsMetrics,
  clearAnalyticsData,
} from '../lib/analytics';

interface AdminDashboardTabProps {
  authUser: User | null;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ authUser }) => {
  const [students, setStudents] = useState<StudentActivity[]>([]);
  const [socSummaries, setSocSummaries] = useState<SocraticSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentActivity | null>(null);

  // Load accumulated real data from localStorage
  const loadData = () => {
    setStudents(getStoredStudentActivities());
    setSocSummaries(getStoredSocraticSummaries());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetData = () => {
    if (confirm('수집된 학습자 통계 데이터를 정말로 초기화하시겠습니까?')) {
      clearAnalyticsData();
      loadData();
    }
  };

  // Check admin authorization
  const isRealAdmin = authUser ? isAdminUser(authUser.email) : false;
  const [previewMode, setPreviewMode] = useState<boolean>(true); // Allowed for demo/preview

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
              <h2 className="text-base font-bold text-white">2027 진로영어 학습자 실시간 대시보드</h2>
              <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold rounded-md">
                LIVE ANALYTICS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              초기화 완료: 이제부터 학생들의 접속, 체류시간, 소크라테스 질의응답 및 변형문제 학습 데이터가 실시간 누적됩니다.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <button
            onClick={handleResetData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-700 hover:border-rose-700 transition-all flex items-center space-x-1.5"
            title="수집된 모든 통계 데이터 리셋"
          >
            <i className="fa-solid fa-rotate-left"></i>
            <span>통계 데이터 초기화</span>
          </button>
        </div>
      </div>

      {/* KPI Top Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">누적 수강 학생 수</span>
            <i className="fa-solid fa-users text-purple-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalStudents}</span>
            <span className="text-xs text-purple-400 font-semibold">명</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">총 로그인 횟수</span>
            <i className="fa-solid fa-key text-cyan-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalLogins}</span>
            <span className="text-xs text-cyan-400 font-semibold">회</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">평균 체류 시간</span>
            <i className="fa-solid fa-clock text-amber-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.avgDwellTimeMinutes}</span>
            <span className="text-xs text-amber-400 font-semibold">분</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">변형문제 생성</span>
            <i className="fa-solid fa-file-pen text-emerald-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalGeneratedQuestions}</span>
            <span className="text-xs text-emerald-400 font-semibold">건</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">소크라테스 질의</span>
            <i className="fa-solid fa-comments text-rose-400 text-sm"></i>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{metrics.totalSocraticConversations}</span>
            <span className="text-xs text-rose-400 font-semibold">건</span>
          </div>
        </div>
      </div>

      {/* Detailed Student Analytics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-users-viewfinder text-purple-400"></i>
            <h3 className="text-xs font-bold text-white">실시간 수집 학생 학습 활동 기록</h3>
            <span className="text-[10px] text-slate-400">({filteredStudents.length}명)</span>
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

        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <i className="fa-solid fa-user-clock text-3xl text-purple-400/40"></i>
            <p className="text-xs font-semibold text-slate-300">현재 누적된 학생 학습 활동 데이터가 없습니다.</p>
            <p className="text-[11px] text-slate-500">
              학생들이 Google 계정(@simin.hs.kr)으로 로그인하면 실시간으로 접속 시각, 체류시간 및 학습 이력이 이곳에 기록됩니다.
            </p>
          </div>
        ) : (
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
                  <th className="py-2.5 px-3">소크라테스 질의</th>
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
                    <td className="py-3 px-3 font-bold text-rose-400 font-mono">{std.socraticQuestionsCount} 건</td>
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
        )}
      </div>

      {/* Socratic Conversation Summary Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-brain text-emerald-400"></i>
            <h3 className="text-xs font-bold text-white">소크라테스 튜터 실시간 대화 기록</h3>
          </div>
          <span className="text-[10px] text-slate-400">({socSummaries.length}건 기록됨)</span>
        </div>

        {socSummaries.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            아직 기록된 소크라테스 튜터 대화 내역이 없습니다. 학생들이 질의 시 이곳에 자동으로 요약 표기됩니다.
          </div>
        ) : (
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
                    힌트 단계: <strong className="text-slate-200">{soc.aiHintLevel}단계 힌트</strong>
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
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <i className="fa-solid fa-address-card text-purple-400"></i>
                <span>[{selectedStudent.name}] 정밀 학습 리포트</span>
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
                  <span className="text-slate-400 block text-[10px]">최근 접속 시각</span>
                  <span className="font-bold text-slate-200 font-mono">{selectedStudent.lastLogin}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">총 학습 체류 시간</span>
                  <span className="font-bold text-amber-300">{selectedStudent.totalDwellTimeMinutes}분</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">수능 변형문제 생성</span>
                  <span className="font-bold text-emerald-400">{selectedStudent.transformedQuestionsGenerated}건</span>
                </div>
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
