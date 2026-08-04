import React, { useState } from 'react';
import { EBSPassage, GeneratedItem } from '../types';
import { safeFetchJson } from '../lib/api';
import { recordGeneratorUsage, recordLearningEvent } from '../lib/analytics';
import { auth } from '../lib/firebase';

import { User } from '../lib/firebase';

interface GeneratorTabProps {
  selectedPassage: EBSPassage;
  customApiKey: string;
  authUser?: User | null;
}

export const GeneratorTab: React.FC<GeneratorTabProps> = ({ selectedPassage, customApiKey, authUser }) => {
  const [targetType, setTargetType] = useState('빈칸 추론');
  const [difficulty, setDifficulty] = useState('수능 표준');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItem, setGeneratedItem] = useState<GeneratedItem | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showOriginalPassage, setShowOriginalPassage] = useState(true);

  const [generatorError, setGeneratorError] = useState<string | null>(null);

  const currentEmail = authUser?.email || auth.currentUser?.email || 'student@simin.hs.kr';
  const currentName = authUser?.displayName || auth.currentUser?.displayName || currentEmail.split('@')[0];

  const handleSelectUserChoice = (idx: number) => {
    setUserChoice(idx);
    setShowAnalysis(true);
    if (generatedItem) {
      recordLearningEvent({
        studentEmail: currentEmail,
        studentName: currentName,
        subject: '진로영어',
        passageId: selectedPassage.id,
        lesson: selectedPassage.lesson,
        itemNo: selectedPassage.itemNo,
        eventType: 'SOLVE_QUIZ',
        questionType: targetType,
        difficulty,
        selectedIndex: idx,
        correctIndex: generatedItem.correctIndex,
        isCorrect: idx === generatedItem.correctIndex,
        reasonText: generatedItem.rationale,
      });
    }
  };

  const generateQuestion = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGeneratorError(null);
    setGeneratedItem(null);
    setUserChoice(null);
    setShowAnalysis(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const data = await safeFetchJson('/api/gemini/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          passage: selectedPassage.passage,
          lesson: selectedPassage.lesson,
          itemNo: selectedPassage.itemNo,
          targetQuestionType: targetType,
          difficulty,
          customApiKey,
        }),
      });

      clearTimeout(timeoutId);

      if (data.success && data.data) {
        setGeneratedItem(data.data);
        recordGeneratorUsage(currentEmail, currentName);
      } else {
        throw new Error(data.error || '변형 문항 생성 실패');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setGeneratorError('응답 시간이 초과되었습니다. 지문을 재선택하거나 다시 시도해 주세요.');
      } else {
        setGeneratorError(`변형 문제 생성 오류: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const cleanOptionText = (rawOpt: string) => {
    if (!rawOpt) return '';
    return rawOpt.replace(/<[^>]*>/g, '').replace(/^[①②③④⑤12345][\.\)]?\s*/, '').trim();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <i className="fa-solid fa-wand-magic-sparkles text-amber-400"></i>
              <span>AI 수능 변형문항 전문 생성기</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              [{selectedPassage.lesson} {selectedPassage.itemNo}] 지문의 논리적 특성에 맞춘 유형별 고품질 수능 문제 정밀 생성
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto items-end">
            {/* Question Type Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 font-medium mb-0.5">출제 유형</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-700 font-semibold focus:outline-none focus:border-amber-500 w-full"
              >
                <option value="빈칸 추론">빈칸 추론</option>
                <option value="어법 판단">어법 판단</option>
                <option value="문장 삽입">문장 삽입</option>
                <option value="어휘 적절성">어휘 적절성</option>
                <option value="주제 및 제목">주제 및 제목</option>
                <option value="요약문 완성">요약문 완성</option>
              </select>
            </div>

            {/* Difficulty Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 font-medium mb-0.5">난이도</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-700 font-semibold focus:outline-none focus:border-amber-500 w-full"
              >
                <option value="수능 표준">수능 표준</option>
                <option value="고난도 (1등급 구분)">고난도 (1등급 구분)</option>
                <option value="기초 / 개념 확인">기초 / 개념 확인</option>
              </select>
            </div>

            {!auth.currentUser ? (
              <div className="mt-4 md:mt-auto p-3 bg-slate-950 rounded-xl border border-rose-500/40 text-center space-y-1">
                <div className="text-xs font-bold text-rose-400 flex items-center justify-center space-x-1.5">
                  <i className="fa-solid fa-lock"></i>
                  <span>🔒 Google 로그인 필요</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  변형 문제 생성은 로그인 후 가능합니다.
                </p>
              </div>
            ) : (
              <button
                onClick={generateQuestion}
                disabled={isGenerating}
                className="mt-4 md:mt-auto px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 shrink-0"
              >
                <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-gear'}`}></i>
                <span>{isGenerating ? '생성 중...' : '변형 문제 생성'}</span>
              </button>
            )}
          </div>
        </div>

        {generatedItem ? (
          <div className="bg-slate-950 p-6 rounded-xl border border-amber-500/30 space-y-5 shadow-2xl">
            {/* Badges Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-500/30 flex items-center space-x-1">
                  <i className="fa-solid fa-list-check text-[10px]"></i>
                  <span>유형: {generatedItem.type || targetType}</span>
                </span>
                <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-3 py-1 rounded-lg border border-purple-500/30">
                  난이도: {difficulty}
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 no-print"
                title="생성된 변형문항 A4 시험지 규격 인쇄 / PDF 저장"
              >
                <i className="fa-solid fa-print text-amber-400"></i>
                <span>시험지 인쇄/PDF</span>
              </button>
            </div>

            {/* Instruction */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <h4 className="text-sm font-bold text-slate-100 flex items-start space-x-2">
                <span className="text-amber-400 font-mono shrink-0">[Q]</span>
                <span>{generatedItem.question}</span>
              </h4>
            </div>

            {/* Passage Header & Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <i className="fa-solid fa-file-lines text-amber-400"></i>
                <span>수능 출제 및 변형 지문</span>
              </span>
              <button
                onClick={() => setShowOriginalPassage(!showOriginalPassage)}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800/50 transition-all flex items-center space-x-1"
              >
                <i className={`fa-solid ${showOriginalPassage ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                <span>{showOriginalPassage ? '원본 지문 접기' : '원본 지문 비교 보기'}</span>
              </button>
            </div>

            {/* Original EBS Passage Box (When Toggled) */}
            {showOriginalPassage && selectedPassage.passage && (
              <div className="p-4 bg-slate-900/60 rounded-xl border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold border-b border-slate-800/80 pb-1.5">
                  <span className="flex items-center space-x-1.5">
                    <i className="fa-solid fa-book-open"></i>
                    <span>[{selectedPassage.lesson} {selectedPassage.itemNo}] 원본 영어 지문 (Original Passage)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">변형 기준 원문</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-all">
                  {selectedPassage.passage}
                </p>
              </div>
            )}

            {/* Formatted Transformed Passage Box */}
            <div className="p-5 bg-slate-900 rounded-xl border border-amber-500/30 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap shadow-inner">
              <div className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider mb-2 pb-1 border-b border-slate-800 flex items-center space-x-1">
                <i className="fa-solid fa-pen-ruler"></i>
                <span>[{generatedItem.type || targetType}] 변형 적용 지문</span>
              </div>
              <div
                dangerouslySetInnerHTML={{
                  __html: (generatedItem.modifiedPassage || (generatedItem as any).passage || selectedPassage.passage || '')
                    .replace(/<u>/g, '<u class="text-amber-300 font-bold underline decoration-amber-400 decoration-2 underline-offset-4">')
                    .replace(/\[\s*(?:주어진\s*문장|Given\s*Sentence)\s*\]\s*\n?([^\n]+)?/gi, (m, sentence) => {
                      return `<div class="p-3.5 my-3 bg-amber-950/70 border border-amber-500/50 rounded-xl text-amber-200 font-semibold shadow-md"><span class="text-amber-400 font-bold block mb-1">📌 [ 주어진 문장 ]</span>${sentence || ''}</div>`;
                    })
                    .replace(/\[\s*(?:요약문|Summary)\s*\]\s*\n?([^\n]+)?/gi, (m, summary) => {
                      return `<div class="p-3.5 my-3 bg-purple-950/70 border border-purple-500/50 rounded-xl text-purple-200 font-semibold shadow-md"><span class="text-purple-400 font-bold block mb-1">📝 [ 요약문 ]</span>${summary || ''}</div>`;
                    })
                }}
              />
            </div>

            {/* Interactive Options */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] text-slate-400 font-semibold mb-2 flex items-center justify-between">
                <span>선지를 클릭하여 정답을 선택하고 상세 해설을 확인하세요:</span>
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="text-amber-400 hover:underline text-[11px] font-bold"
                >
                  {showAnalysis ? '해설 숨기기' : '정답 및 상세 해설 전체 보기'}
                </button>
              </div>

              {generatedItem.options?.map((opt, idx) => {
                const isSelected = userChoice === idx;
                const isCorrect = idx === generatedItem.correctIndex;
                let btnStyle = 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850';

                if (userChoice !== null || showAnalysis) {
                  if (isCorrect) btnStyle = 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200 font-bold ring-1 ring-emerald-500/30';
                  else if (isSelected) btnStyle = 'bg-rose-950/80 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/30';
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectUserChoice(idx)}
                    className={`p-3.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${btnStyle}`}
                  >
                    <span className="flex items-start space-x-3 pr-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        (userChoice !== null || showAnalysis) && isCorrect
                          ? 'bg-emerald-500 text-slate-950'
                          : isSelected
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {['①', '②', '③', '④', '⑤'][idx] || (idx + 1)}
                      </span>
                      <span className="leading-snug">{cleanOptionText(opt)}</span>
                    </span>

                    {(userChoice !== null || showAnalysis) && (
                      <span className="shrink-0 ml-2">
                        {isCorrect ? (
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/30 flex items-center space-x-1">
                            <i className="fa-solid fa-check"></i>
                            <span>정답</span>
                          </span>
                        ) : isSelected ? (
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-md border border-rose-500/30">
                            오답 선택
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Analysis & Explanations Panel */}
            {(showAnalysis || userChoice !== null) && (
              <div className="mt-6 space-y-4 pt-4 border-t border-slate-800">
                {/* User Answer Feedback */}
                {userChoice !== null && (
                  <div className={`p-4 rounded-xl border ${
                    userChoice === generatedItem.correctIndex
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                      <i className={`fa-solid ${userChoice === generatedItem.correctIndex ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-rose-400'}`}></i>
                      <span>
                        {userChoice === generatedItem.correctIndex
                          ? '축하합니다! 정답입니다.'
                          : `아쉽습니다. 정답은 ${generatedItem.correctIndex + 1}번입니다.`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Overall Rationale */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-amber-500/30 text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-amber-400 block mb-1.5 text-xs flex items-center space-x-1.5">
                    <i className="fa-solid fa-graduation-cap"></i>
                    <span>출제 의도 및 정답 논리 해설</span>
                  </span>
                  <p className="text-slate-200 leading-relaxed">{generatedItem.rationale}</p>
                </div>

                {/* Distractor Breakdown */}
                {generatedItem.distractorAnalysis && generatedItem.distractorAnalysis.length > 0 && (
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                    <span className="font-bold text-cyan-400 block mb-2 text-xs flex items-center space-x-1.5">
                      <i className="fa-solid fa-list-ol"></i>
                      <span>선지별 상세 오답 & 정답 원인 분석</span>
                    </span>
                    <div className="space-y-1.5">
                      {generatedItem.distractorAnalysis.map((d, i) => (
                        <div key={i} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-start space-x-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            d.isCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {i + 1}번
                          </span>
                          <span className="text-slate-300 leading-relaxed">{d.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {generatedItem.vocabularyHighlights && (
                    <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[11px] font-bold text-pink-400 block mb-1.5">
                        <i className="fa-solid fa-spell-check mr-1"></i> 문항 출제 핵심 어휘:
                      </span>
                      <ul className="space-y-1">
                        {generatedItem.vocabularyHighlights.map((vh, i) => (
                          <li key={i} className="text-[11px] text-slate-300 font-mono">• {vh}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {generatedItem.syntaxHighlights && (
                    <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[11px] font-bold text-cyan-400 block mb-1.5">
                        <i className="fa-solid fa-code mr-1"></i> 수능 출제 구문 포인트:
                      </span>
                      <ul className="space-y-1">
                        {generatedItem.syntaxHighlights.map((sh, i) => (
                          <li key={i} className="text-[11px] text-slate-300 font-mono">• {sh}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
            <i className="fa-solid fa-file-pen text-4xl mb-3 text-slate-700"></i>
            <p className="text-sm font-bold">상단 '변형 문제 생성' 버튼을 누르세요.</p>
            <p className="text-xs text-slate-600 mt-1">
              선택하신 출제 유형({targetType})과 난이도({difficulty})에 맞추어 전문 변형 문제가 생성됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

