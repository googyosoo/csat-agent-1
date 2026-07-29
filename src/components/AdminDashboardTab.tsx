import React, { useState, useEffect } from 'react';
import { User } from '../lib/firebase';
import { isAdminUser, ADMIN_EMAILS } from '../lib/adminAuth';
import {
  StudentActivity,
  SocraticSummary,
  StudentReflection,
  fetchFirestoreStudentActivities,
  fetchFirestoreSocraticSummaries,
  fetchFirestoreStudentReflections,
  calculateAnalyticsMetrics,
  clearAnalyticsData,
} from '../lib/analytics';
import { safeFetchJson } from '../lib/api';

interface AdminDashboardTabProps {
  authUser: User | null;
}

interface StudentReportResult {
  studentEmail: string;
  studentName: string;
  personalizedFeedback: string;
  schoolRecordSetek: string;
  byteCount: number;
  keyCompetencies: string[];
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ authUser }) => {
  const [students, setStudents] = useState<StudentActivity[]>([]);
  const [socSummaries, setSocSummaries] = useState<SocraticSummary[]>([]);
  const [reflections, setReflections] = useState<StudentReflection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentActivity | null>(null);

  // AI Setek Generator State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<StudentReportResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Load accumulated real data from Firestore DB (or LocalStorage fallback)
  const loadData = async () => {
    const sList = await fetchFirestoreStudentActivities();
    const socList = await fetchFirestoreSocraticSummaries();
    const refList = await fetchFirestoreStudentReflections();
    setStudents(sList);
    setSocSummaries(socList);
    setReflections(refList);
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

  const handleGenerateStudentReport = async (student: StudentActivity) => {
    setSelectedStudent(student);
    setIsGeneratingReport(true);
    setReportResult(null);
    setCopied(false);

    const studentSocraticLogs = socSummaries.filter(
      (soc) => soc.studentEmail.toLowerCase() === student.email.toLowerCase()
    );

    try {
      const data = await safeFetchJson('/api/gemini/student-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student,
          socraticLogs: studentSocraticLogs,
        }),
      });

      if (data.success && data.data) {
        setReportResult(data.data);
      } else {
        throw new Error(data.error || '보고서 생성 실패');
      }
    } catch (err: any) {
      alert(`AI 세특 & 피드백 리포트 생성 오류: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopySetek = () => {
    if (!reportResult?.schoolRecordSetek) return;
    navigator.clipboard.writeText(reportResult.schoolRecordSetek);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Check admin authorization
  const isRealAdmin = authUser ? isAdminUser(authUser.email) : false;
  const [previewMode, setPreviewMode] = useState<boolean>(true); // Preview for demo

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
              <h2 className="text-base font-bold text-white">2027 진로영어 학습자 대시보드 & AI 세특 생성기</h2>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-md">
                FIRESTORE LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              학생별 실시간 학습 데이터 수집 및 800~900바이트 내외 생기부 세특(세부능력 및 특기사항) 자동 생성
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
            <span>통계 초기화</span>
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
            <h3 className="text-xs font-bold text-white">학생별 세부 학습 현황 & AI 세특 생성</h3>
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
                  <th className="py-2.5 px-3">최근 접속</th>
                  <th className="py-2.5 px-3">체류 시간</th>
                  <th className="py-2.5 px-3">완료 지문</th>
                  <th className="py-2.5 px-3">변형 문제</th>
                  <th className="py-2.5 px-3">소크라테스</th>
                  <th className="py-2.5 px-3 text-right">AI 세특 & 피드백</th>
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
                    </td>
                    <td className="py-3 px-3 font-bold text-purple-300 font-mono">{std.completedPassagesCount} 지문</td>
                    <td className="py-3 px-3 font-bold text-cyan-300 font-mono">{std.transformedQuestionsGenerated} 문제</td>
                    <td className="py-3 px-3 font-bold text-rose-400 font-mono">{std.socraticQuestionsCount} 건</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleGenerateStudentReport(std)}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-950/50 transition-all flex items-center space-x-1.5 ml-auto"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles text-cyan-300"></i>
                        <span>AI 세특 & 피드백</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-time Student Reflections Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-sm">
              <i className="fa-solid fa-pen-fancy"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>📝 학생 문항 학습 소감 & 메타인지 성찰 기록</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                  총 {reflections.length}건 수집됨
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                지문 분석 워크북에서 학생이 직접 작성한 오답 원인, 구문 이해 소감 및 학업 탐구 태도 실시간 기록입니다.
              </p>
            </div>
          </div>
        </div>

        {reflections.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <i className="fa-solid fa-note-sticky text-3xl mb-2 text-slate-700"></i>
            <p>아직 제출된 학생 문항 소감이 없습니다. 학생이 워크북에서 소감을 제출하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto">
            {reflections.map((ref) => (
              <div key={ref.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200">{ref.studentName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({ref.studentEmail})</span>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800/60 rounded text-[10px] font-mono">
                    {ref.lesson} {ref.itemNo}
                  </span>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  📌 <span className="text-slate-300 font-bold">{ref.passageTitle}</span>
                </div>

                <p className="text-xs text-purple-100 bg-purple-950/30 p-2.5 rounded-lg border border-purple-900/40 font-serif leading-relaxed italic">
                  "{ref.reflectionText}"
                </p>

                <div className="text-[10px] text-slate-500 text-right font-mono">
                  {ref.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student AI Setek & Feedback Report Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-lg font-bold">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    [{selectedStudent.name}] 학생 AI 피드백 & 생활기록부 세특
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">{selectedStudent.email}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setReportResult(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {isGeneratingReport ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xl font-bold mx-auto animate-bounce">
                  <i className="fa-solid fa-brain animate-spin"></i>
                </div>
                <h4 className="text-sm font-bold text-white">Gemini 3.6 Flash가 학습자 세특 & 피드백을 작성 중입니다...</h4>
                <p className="text-xs text-slate-400">
                  EBS 지문 학습 실적, 소크라테스 3단계 힌트 응용 및 변형문제 성취도를 종합 분석하는 중입니다.
                </p>
              </div>
            ) : reportResult ? (
              <div className="space-y-5 text-xs">
                {/* Competency Tags */}
                <div className="flex flex-wrap gap-2">
                  {reportResult.keyCompetencies.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold rounded-lg"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* 1. Personalized Feedback */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200 flex items-center space-x-2 text-xs">
                    <i className="fa-solid fa-user-check text-cyan-400"></i>
                    <span>학생 맞춤형 학습 성취도 피드백</span>
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px] font-sans">
                    {reportResult.personalizedFeedback}
                  </p>
                </div>

                {/* 2. Official NEIS School Record Setek (800~900 Bytes) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-purple-500/30 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-300 flex items-center space-x-2 text-xs">
                      <i className="fa-solid fa-file-signature text-purple-400"></i>
                      <span>학교생활기록부 세부능력 및 특기사항 (세특 문안)</span>
                    </h4>

                    {/* Byte Counter Badge */}
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 bg-slate-900 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-bold rounded-md">
                        {reportResult.byteCount} / 900 bytes
                      </span>
                      <button
                        onClick={handleCopySetek}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center space-x-1 ${
                          copied
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
                        }`}
                      >
                        <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                        <span>{copied ? '복사 완료!' : '세특 원클릭 복사'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 leading-relaxed font-serif text-[12px] whitespace-pre-wrap selection:bg-purple-500 selection:text-white">
                    {reportResult.schoolRecordSetek}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                버튼을 눌러 AI 세특 & 피드백 리포트를 생성해 보세요.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setReportResult(null);
                }}
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
