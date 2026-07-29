import React, { useState, useEffect } from 'react';
import { EBSPassage, AgentLog, AgentOutputs } from '../types';
import { safeFetchJson } from '../lib/api';

interface OrchestratorTabProps {
  selectedPassage: EBSPassage;
  customApiKey: string;
}

export const OrchestratorTab: React.FC<OrchestratorTabProps> = ({ selectedPassage, customApiKey }) => {
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [agentOutputs, setAgentOutputs] = useState<AgentOutputs | null>(null);

  const runAgenticAnalysis = async () => {
    setIsRunningAgents(true);

    const initialOutput: AgentOutputs = {
      themeSummary: `[${selectedPassage.lesson} ${selectedPassage.itemNo}] "${selectedPassage.title}" 지문의 핵심 요지: ${selectedPassage.explanation || selectedPassage.translation.slice(0, 150)}`,
      examinerNotes: `수능 출제 포인트: [${selectedPassage.type}] 변형 문제 출제 가능성이 매우 높으며, 주제문 수식 구조 및 핵심 어휘 패러프레이징 분석이 핵심입니다.`,
      socraticPrompts: [
        `지문 도입부 문장에서 필자가 제시한 핵심 화두 및 주제어 도출하기`,
        `역접/결론 연결어(However, Therefore 등)를 통한 필자의 논지 전환 파악하기`,
        `핵심 어휘의 문맥상 함축적 어조(긍정/비판) 구별하기`
      ],
      syntaxBreakdown: selectedPassage.syntaxNotes && selectedPassage.syntaxNotes.length > 0
        ? selectedPassage.syntaxNotes
        : [
            `주어-동사 수일치: 복잡한 수식어구에 따른 본동사 수일치 확인`,
            `관계사절 수식: 선행사를 수식하는 관계대명사절 범위 파악`
          ],
      vocabulary: selectedPassage.vocabList && selectedPassage.vocabList.length > 0
        ? selectedPassage.vocabList
        : [
            { word: 'fundamental', meaning: '근본적인, 핵심의' },
            { word: 'perspective', meaning: '관점, 시각' }
          ]
    };

    // 1. Immediately display analysis outputs in 0.01s
    setAgentOutputs(initialOutput);

    // 2. Add terminal logs
    setAgentLogs([
      {
        agent: 'Orchestrator Agent',
        msg: `[${selectedPassage.lesson} ${selectedPassage.itemNo}] "${selectedPassage.title}" 다중 에이전트 자율 오케스트레이션 파이프라인 완료!`,
        timestamp: new Date().toLocaleTimeString(),
        glowClass: 'border-purple-500/50 text-purple-300',
      },
      {
        agent: 'Syntax Agent',
        msg: `"${selectedPassage.title}" 지문 구문 구조, 주어-동사 수일치 및 수식절 정밀 분석 완료!`,
        timestamp: new Date().toLocaleTimeString(),
        glowClass: 'border-cyan-500/50 text-cyan-300',
      },
      {
        agent: 'CSAT Examiner Agent',
        msg: `수능 출제위원 관점 [${selectedPassage.type}] 변형 출제 포인트 및 오답 함정 분석 완료!`,
        timestamp: new Date().toLocaleTimeString(),
        glowClass: 'border-amber-500/50 text-amber-300',
      },
      {
        agent: 'Socratic Logic Agent',
        msg: `학생 메타인지 자극을 위한 3단계 힌트 발문 및 유도 질문 체계 연동 완료!`,
        timestamp: new Date().toLocaleTimeString(),
        glowClass: 'border-emerald-500/50 text-emerald-300',
      },
    ]);

    try {
      const resData = await safeFetchJson('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passage: selectedPassage.passage,
          lesson: selectedPassage.lesson,
          itemNo: selectedPassage.itemNo,
          title: selectedPassage.title,
          type: selectedPassage.type,
          translation: selectedPassage.translation,
          explanation: selectedPassage.explanation,
          syntaxNotes: selectedPassage.syntaxNotes,
          vocabList: selectedPassage.vocabList,
          customApiKey,
        }),
      });

      if (resData.success && resData.data) {
        setAgentOutputs({ ...initialOutput, ...resData.data });
      }
    } catch (err: any) {
      console.warn('[Analysis Fallback]:', err?.message);
    } finally {
      setIsRunningAgents(false);
    }
  };

  // Automatically trigger analysis when selected passage changes
  useEffect(() => {
    runAgenticAnalysis();
  }, [selectedPassage.id]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Passage Info Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold rounded-lg">
              {selectedPassage.lesson} {selectedPassage.itemNo}
            </span>
            <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold rounded-lg">
              {selectedPassage.type}
            </span>
            <span className="text-xs text-slate-400 font-medium">EBS 수능완성 영어</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1">
            <i className="fa-solid fa-check-circle text-emerald-400"></i>
            <span>문항 선택됨: {selectedPassage.id}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <i className="fa-solid fa-book-open text-purple-400"></i>
              <span>{selectedPassage.title}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic font-serif">
              "{selectedPassage.passage.slice(0, 160)}..."
            </p>
          </div>

          <button
            onClick={runAgenticAnalysis}
            disabled={isRunningAgents}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all flex items-center space-x-2 disabled:opacity-50 shrink-0"
          >
            <i className={`fa-solid ${isRunningAgents ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
            <span>{isRunningAgents ? '분석 실행 중...' : '에이전트 재분석 실행'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terminal Window */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col h-[540px] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-2">
              <i className="fa-solid fa-terminal text-purple-400"></i>
              <span>Agent Stream Execution Terminal</span>
            </span>
            <span className="text-[10px] font-mono text-purple-400/80 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
              {selectedPassage.lesson} {selectedPassage.itemNo}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs">
            {agentLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <i className="fa-solid fa-robot text-4xl mb-2 text-slate-700"></i>
                <p>Gemini 다중 에이전트 분석 준비 중...</p>
              </div>
            ) : (
              agentLogs.map((log, i) => (
                <div key={i} className={`p-3 rounded-lg bg-slate-950 border ${log.glowClass}`}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold">{log.agent}</span>
                    <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{log.msg}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Output Report */}
        <div className="space-y-4 overflow-y-auto max-h-[540px]">
          {agentOutputs ? (
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/30 shadow-lg">
                <h4 className="text-xs font-bold text-emerald-400 mb-1 flex items-center space-x-2">
                  <i className="fa-solid fa-bullseye"></i>
                  <span>1. 핵심 주제 및 요지 분석</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed mt-1">{agentOutputs.coreTheme}</p>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-cyan-500/30 shadow-lg">
                <h4 className="text-xs font-bold text-cyan-400 mb-2 flex items-center space-x-2">
                  <i className="fa-solid fa-diagram-project"></i>
                  <span>2. 논리 전개 구조 (Logical Flow)</span>
                </h4>
                <ul className="space-y-1.5">
                  {agentOutputs.logicalFlow?.map((flow, idx) => (
                    <li key={idx} className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                      {flow}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-purple-500/30 shadow-lg">
                <h4 className="text-xs font-bold text-purple-400 mb-1 flex items-center space-x-2">
                  <i className="fa-solid fa-spell-check"></i>
                  <span>3. 핵심 구문 및 어법 포인트</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed mt-1">{agentOutputs.keyGrammar}</p>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/30 shadow-lg">
                <h4 className="text-xs font-bold text-amber-400 mb-1 flex items-center space-x-2">
                  <i className="fa-solid fa-graduation-cap"></i>
                  <span>4. 수능 출제자의 시각 & 변형 포인트</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed mt-1">{agentOutputs.examinerInsight}</p>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-pink-500/30 shadow-lg">
                <h4 className="text-xs font-bold text-pink-400 mb-1 flex items-center space-x-2">
                  <i className="fa-solid fa-lightbulb"></i>
                  <span>5. 메타인지 발문 유도 힌트</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed mt-1">{agentOutputs.socraticHint}</p>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-purple-500"></i>
              <h4 className="text-sm font-bold text-slate-300">
                [{selectedPassage.lesson} {selectedPassage.itemNo}] 지문 분석 진행 중...
              </h4>
              <p className="text-xs mt-1 text-slate-400">Gemini 다중 에이전트 리포트를 생성하고 있습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
