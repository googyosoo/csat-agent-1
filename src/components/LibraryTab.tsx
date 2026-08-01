import React, { useState, useEffect } from 'react';
import { EBSPassage } from '../types';
import { recordStudentReflection } from '../lib/analytics';
import { auth } from '../lib/firebase';

interface LibraryTabProps {
  selectedPassage: EBSPassage;
  isSpeaking?: boolean;
  onSpeak?: (text: string) => void;
  onStopSpeak?: () => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  selectedPassage,
  isSpeaking = false,
  onSpeak,
  onStopSpeak,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [reflectionInput, setReflectionInput] = useState('');
  const [isSavedReflection, setIsSavedReflection] = useState(false);

  // Reset selected option & reflection state when passage changes
  useEffect(() => {
    setSelectedOption(null);
    setReflectionInput('');
    setIsSavedReflection(false);
  }, [selectedPassage.id]);

  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === selectedPassage.answerIndex;

  const handleSaveReflection = () => {
    if (!reflectionInput.trim()) return;

    recordStudentReflection({
      studentEmail: auth.currentUser?.email,
      studentName: auth.currentUser?.displayName,
      passageId: selectedPassage.id,
      lesson: selectedPassage.lesson,
      itemNo: selectedPassage.itemNo,
      passageTitle: selectedPassage.title,
      reflectionText: reflectionInput,
    });

    setIsSavedReflection(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Passage Display Box */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">
              2027 진로영어 ({selectedPassage.lesson} {selectedPassage.itemNo})
            </span>
            <h3 className="text-xl font-extrabold text-white mt-1">{selectedPassage.title}</h3>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {isSpeaking ? (
              <button
                onClick={onStopSpeak}
                className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-xl hover:bg-rose-500/30 transition-all flex items-center space-x-2"
              >
                <i className="fa-solid fa-volume-xmark"></i>
                <span>낭독 중지</span>
              </button>
            ) : (
              <button
                onClick={() => onSpeak && onSpeak(selectedPassage.passage)}
                className="px-3.5 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/40 text-xs font-bold rounded-xl hover:bg-blue-600/30 transition-all flex items-center space-x-2"
              >
                <i className="fa-solid fa-volume-high"></i>
                <span>원문 AI 낭독</span>
              </button>
            )}
          </div>
        </div>

        {/* English Passage Text */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 font-serif text-slate-100 text-base leading-relaxed tracking-wide select-text">
          <div
            dangerouslySetInnerHTML={{
              __html: (selectedPassage.passage || '')
                .replace(/_{4,}/g, '<u class="inline-block mx-1 px-3 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md font-bold font-mono text-sm underline decoration-amber-400 decoration-2 underline-offset-4 shadow-inner">[___________]</u>')
                .replace(/\[\s*______+\s*\]/g, '<u class="inline-block mx-1 px-3 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md font-bold font-mono text-sm underline decoration-amber-400 decoration-2 underline-offset-4 shadow-inner">[___________]</u>')
            }}
          />

          {/* If Question Type is '빈칸 추론' but no underline marker exists in passage text */}
          {selectedPassage.type === '빈칸 추론' && !/_{4,}|\[\s*______+\s*\]/.test(selectedPassage.passage || '') && (
            <div className="mt-4 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 font-semibold flex items-center space-x-2">
              <i className="fa-solid fa-pen-ruler text-amber-400"></i>
              <span>[ 빈칸 추론 문항 위치 ]:</span>
              <span className="px-3 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md font-bold font-mono">[___________]</span>
            </div>
          )}
        </div>

        {/* 요약문 완성 전용 [ 요약문 (Summary) ] 카드 */}
        {(selectedPassage.type === '요약문 완성' || selectedPassage.summarySentence) && (
          <div className="p-4 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-2">
            <div className="text-xs font-bold text-purple-300 flex items-center justify-between border-b border-purple-500/20 pb-2">
              <span className="flex items-center space-x-1.5">
                <i className="fa-solid fa-file-pen text-purple-400"></i>
                <span>[ 요약문 (Summary) ]</span>
              </span>
              <span className="text-[10px] text-purple-400 font-normal">빈칸 (A), (B)에 들어갈 말로 가장 적절한 것을 고르시오.</span>
            </div>
            <div
              className="text-sm font-sans text-purple-100 font-medium leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: (selectedPassage.summarySentence || `By analyzing the main passage, technology affects (A) [___________] and influences emotional (B) [___________].`)
                  .replace(/\(A\)\s*([\w-]+)?/g, '<span class="inline-block px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-bold font-mono text-xs mx-1">(A) [___________]</span>')
                  .replace(/\(B\)\s*([\w-]+)?/g, '<span class="inline-block px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-bold font-mono text-xs mx-1">(B) [___________]</span>')
              }}
            />
          </div>
        )}

        {/* Question & Options Header */}
        <div className="pt-2">
          <h4 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/60 rounded text-xs font-bold">
              {selectedPassage.type}
            </span>
            <span>
              {selectedPassage.type === '빈칸 추론' && '다음 글의 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.'}
              {selectedPassage.type === '요약문 완성' && '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?'}
              {selectedPassage.type === '무관한 문장' && '다음 글에서 전체 흐름과 관계 없는 문장은?'}
              {selectedPassage.type === '글의 순서' && '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것을 고르시오.'}
              {selectedPassage.type === '주어진 문장의 위치' && '글의 흐름으로 보아, 주어진 문장이 들어가지에 가장 적절한 곳은?'}
              {!['빈칸 추론', '요약문 완성', '무관한 문장', '글의 순서', '주어진 문장의 위치'].includes(selectedPassage.type) && '다음 글을 읽고 문항의 정답을 고르시오.'}
            </span>
          </h4>
        </div>

        {/* Options List */}
        <div className="space-y-2.5">
          {selectedPassage.options.map((opt, idx) => {
            const isAnswerOption = idx === selectedPassage.answerIndex;
            const isUserChosen = idx === selectedOption;

            let optionStyle =
              'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300';

            if (isAnswered) {
              if (isAnswerOption) {
                optionStyle = 'border-emerald-500/80 bg-emerald-950/40 text-emerald-200 font-semibold';
              } else if (isUserChosen) {
                optionStyle = 'border-rose-500/80 bg-rose-950/40 text-rose-200 line-through opacity-80';
              } else {
                optionStyle = 'border-slate-800/40 bg-slate-950/30 text-slate-500 opacity-60';
              }
            }

            return (
              <div
                key={idx}
                onClick={() => !isAnswered && setSelectedOption(idx)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${optionStyle}`}
              >
                <span className="text-sm leading-relaxed">{opt}</span>

                {isAnswered && (
                  <div className="shrink-0 ml-3">
                    {isAnswerOption && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/30 flex items-center space-x-1">
                        <i className="fa-solid fa-check text-emerald-400"></i>
                        <span>EBS 정답</span>
                      </span>
                    )}
                    {!isAnswerOption && isUserChosen && (
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-md border border-rose-500/30 flex items-center space-x-1">
                        <i className="fa-solid fa-xmark text-rose-400"></i>
                        <span>내가 선택한 오답</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Translation & Explanation Conditional Container */}
        {!isAnswered ? (
          <div className="bg-slate-950/70 p-6 rounded-xl border border-slate-800 border-dashed text-center flex flex-col items-center justify-center space-y-3 my-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl">
              <i className="fa-solid fa-hand-pointer animate-bounce"></i>
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-200">위 선택지 중 하나를 선택해 보세요!</h5>
              <p className="text-xs text-slate-400 mt-1">
                답을 직접 선택하면 정답 여부와 함께 지문 전체 한국어 번역 및 EBS 상세 해설이 공개됩니다.
              </p>
            </div>
            <button
              onClick={() => setSelectedOption(selectedPassage.answerIndex)}
              className="mt-1 text-xs text-slate-400 hover:text-blue-400 underline underline-offset-4 transition-colors"
            >
              선택 없이 번역/해설 바로보기
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-800 pt-6 space-y-5 animate-fadeIn">
            {/* Answer Result Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                isCorrect
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                    isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  <i className={`fa-solid ${isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                </div>
                <div>
                  <h5 className="text-sm font-extrabold">
                    {isCorrect
                      ? `🎉 정답입니다! (${selectedOption + 1}번)`
                      : `❌ 아쉽네요! (선택한 답: ${selectedOption + 1}번 / EBS 정답: ${selectedPassage.answerIndex + 1}번)`}
                  </h5>
                  <p className="text-xs opacity-90 mt-0.5">
                    {isCorrect
                      ? '지문 구조와 선택지 논리를 올바르게 파악했습니다. 아래 번역과 해설을 통해 구문을 복습하세요.'
                      : 'EBS 해설을 읽고 어느 부분에서 오답 함정에 빠졌는지 점검해 보세요.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOption(null)}
                className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700 shrink-0 font-semibold"
              >
                다시 풀어보기
              </button>
            </div>

            {/* Translation */}
            <div className="bg-slate-950/90 p-5 rounded-xl border border-slate-800 space-y-2">
              <h5 className="text-xs font-bold text-blue-400 flex items-center space-x-2 uppercase tracking-wider">
                <i className="fa-solid fa-language"></i>
                <span>지문 전문 자연스러운 한국어 번역</span>
              </h5>
              <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap pl-1">
                {selectedPassage.translation}
              </p>
            </div>

            {/* Explanation */}
            <div className="bg-emerald-950/30 p-5 rounded-xl border border-emerald-500/30 space-y-2">
              <h5 className="text-xs font-bold text-emerald-400 flex items-center space-x-2 uppercase tracking-wider">
                <i className="fa-solid fa-lightbulb"></i>
                <span>EBS 정답 논리 해설</span>
              </h5>
              <p className="text-sm text-emerald-100 leading-relaxed font-sans whitespace-pre-wrap pl-1">
                {selectedPassage.explanation}
              </p>
            </div>
          </div>
        )}

        {/* Student Reflection & Feedback Card (Positioned at bottom) */}
        <div className="mt-8 border-t border-purple-500/30 pt-6">
          <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/40 p-6 rounded-2xl border border-purple-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 text-lg">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center space-x-2">
                    <span>✍️ 문항에 대한 생각 및 메타인지 소감 작성</span>
                    <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40">
                      생기부 세특 반영
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    문항을 풀고 난 느낌, 구문 분석 소감, 오답 이유 등을 작성해 보세요. 관리자 대시보드 및 세특 생성기에 자동 저장됩니다.
                  </p>
                </div>
              </div>
            </div>

            {!auth.currentUser ? (
              <div className="bg-slate-950 p-5 rounded-xl border border-rose-500/40 text-center space-y-2.5">
                <div className="flex items-center justify-center space-x-2 text-rose-400 font-bold text-xs">
                  <i className="fa-solid fa-lock text-sm"></i>
                  <span>🔒 학생 메타인지 소감 및 생기부 성찰 기록은 Google 로그인 후 작성 가능합니다.</span>
                </div>
                <p className="text-xs text-slate-400">
                  시민고등학교 학생 계정(@simin.hs.kr) 또는 지정 관리자 계정으로 우측 상단의 <strong className="text-blue-400">Google 로그인</strong> 후 소감을 작성하실 수 있습니다.
                </p>
              </div>
            ) : isSavedReflection ? (
              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/40 text-emerald-300 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-circle-check text-xl text-emerald-400"></i>
                  <div>
                    <h5 className="text-xs font-bold">소감이 성공적으로 작성되어 관리자 대시보드에 전달되었습니다!</h5>
                    <p className="text-[11px] opacity-90 mt-0.5 italic font-serif">"{reflectionInput}"</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSavedReflection(false)}
                  className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-xs rounded-lg border border-emerald-700/50"
                >
                  수정하기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={reflectionInput}
                  onChange={(e) => setReflectionInput(e.target.value)}
                  placeholder={`예: [${selectedPassage.lesson} ${selectedPassage.itemNo}] 문항을 풀면서 가주어-진주어 구문 파악이 조금 까다로웠지만, 소크라테스 튜터를 통해 주제 문장의 역접 구조를 명확히 이해했습니다.`}
                  className="w-full bg-slate-950 p-3.5 rounded-xl border border-purple-900/40 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors leading-relaxed"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    작성자: {auth.currentUser?.displayName || auth.currentUser?.email || '학습자'}
                  </span>

                  <button
                    onClick={handleSaveReflection}
                    disabled={!reflectionInput.trim()}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 transition-all flex items-center space-x-2 disabled:opacity-40 shrink-0"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>소감 제출 & 세특 저장</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
