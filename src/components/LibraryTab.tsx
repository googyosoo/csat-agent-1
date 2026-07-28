import React, { useState, useEffect } from 'react';
import { EBSPassage } from '../types';

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

  // Reset selected option when passage changes
  useEffect(() => {
    setSelectedOption(null);
  }, [selectedPassage.id]);

  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === selectedPassage.answerIndex;

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
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-950/50 flex items-center space-x-2 transition-all animate-pulse"
                title="음성 리딩 즉시 멈춤"
              >
                <i className="fa-solid fa-circle-stop"></i>
                <span>리딩 멈춤</span>
              </button>
            ) : (
              <button
                onClick={() => onSpeak && onSpeak(selectedPassage.passage)}
                className="px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl text-xs font-bold border border-blue-500/30 flex items-center space-x-2 transition-all"
                title="지문 전체 원어민 발음 리딩"
              >
                <i className="fa-solid fa-volume-high text-blue-400"></i>
                <span>지문 음성 리딩</span>
              </button>
            )}

            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              ID: {selectedPassage.id}
            </span>
          </div>
        </div>

        {/* Box Sentence if available (주어진 문장의 위치 등) */}
        {selectedPassage.boxSentence && (
          <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-sm leading-relaxed font-serif">
            <span className="font-bold text-amber-400 block mb-1 text-xs uppercase tracking-wider">[주어진 문장 Box]</span>
            {selectedPassage.boxSentence}
          </div>
        )}

        {/* Summary Sentence if available (요약문 완성 등) */}
        {selectedPassage.summarySentence && (
          <div className="mb-4 p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl text-indigo-200 text-sm leading-relaxed font-serif">
            <span className="font-bold text-indigo-400 block mb-1 text-xs uppercase tracking-wider">[요약문 Box]</span>
            {selectedPassage.summarySentence}
          </div>
        )}

        <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 leading-relaxed text-base font-sans selection:bg-blue-500 selection:text-white whitespace-pre-wrap">
          {selectedPassage.passage}
        </div>
      </div>

      {/* Original EBS Questions & Interactive Choices */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
            <i className="fa-solid fa-circle-question text-blue-500"></i>
            <span>[EBS 원문 선택지 및 정답 - {selectedPassage.type}]</span>
          </h4>
          {isAnswered && (
            <button
              onClick={() => setSelectedOption(null)}
              className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>다시 풀기</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {selectedPassage.options.map((opt, idx) => {
            const isAnswerOption = idx === selectedPassage.answerIndex;
            const isUserChosen = selectedOption === idx;

            let optionStyle = 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:bg-slate-950';
            if (isAnswered) {
              if (isAnswerOption) {
                optionStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold shadow-lg shadow-emerald-950/50';
              } else if (isUserChosen) {
                optionStyle = 'bg-rose-950/70 border-rose-500 text-rose-200 font-bold';
              } else {
                optionStyle = 'bg-slate-950/30 border-slate-900 text-slate-500 opacity-60';
              }
            }

            return (
              <div
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`p-4 rounded-xl border text-sm flex items-center justify-between cursor-pointer transition-all duration-200 ${optionStyle}`}
              >
                <span className="flex items-center space-x-3.5">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isAnswered && isAnswerOption
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : isAnswered && isUserChosen
                        ? 'bg-rose-500 text-white font-black'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{opt}</span>
                </span>
                
                {isAnswered && (
                  <div>
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
      </div>
    </div>
  );
};

