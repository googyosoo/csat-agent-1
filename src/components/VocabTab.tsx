import React, { useState, useEffect } from 'react';
import { EBSPassage, VocabItem } from '../types';

interface VocabTabProps {
  selectedPassage: EBSPassage;
  onSpeak: (text: string) => void;
}

export const VocabTab: React.FC<VocabTabProps> = ({ selectedPassage, onSpeak }) => {
  const [viewMode, setViewMode] = useState<'list' | 'flashcard'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideMeanings, setHideMeanings] = useState(false);

  // Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [showOnlyUnmastered, setShowOnlyUnmastered] = useState(false);
  const [deck, setDeck] = useState<VocabItem[]>([]);

  // Initialize deck whenever passage or filter changes
  useEffect(() => {
    let list = selectedPassage.vocabList || [];
    if (showOnlyUnmastered) {
      list = list.filter((item) => !masteredWords.has(item.word));
    }
    setDeck(list);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedPassage, showOnlyUnmastered, masteredWords]);

  const filteredVocab = (selectedPassage.vocabList || []).filter((item) =>
    item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMastered = (word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMasteredWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  const handleNextCard = () => {
    if (deck.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % deck.length);
    }, 150);
  };

  const handlePrevCard = () => {
    if (deck.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
    }, 150);
  };

  const handleShuffleDeck = () => {
    if (deck.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      const shuffled = [...deck].sort(() => Math.random() - 0.5);
      setDeck(shuffled);
      setCurrentIndex(0);
    }, 150);
  };

  // Keyboard navigation for Flashcard mode
  useEffect(() => {
    if (viewMode !== 'flashcard') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, deck]);

  const currentCard = deck[currentIndex];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        {/* Header & Mode Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <i className="fa-solid fa-book-bookmark text-pink-500"></i>
              <span>[{selectedPassage.lesson} {selectedPassage.itemNo}] 핵심 어휘 & 구문 정밀 보관함</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              수능 필수 어휘 {selectedPassage.vocabList?.length || 0}개 및 스마트 플래시카드 학습을 제공합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'list'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fa-solid fa-list-ul"></i>
              <span>어휘 목록</span>
            </button>

            <button
              onClick={() => setViewMode('flashcard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'flashcard'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fa-solid fa-clone"></i>
              <span>플래시카드 모드</span>
            </button>
          </div>
        </div>

        {/* LIST VIEW MODE */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            {/* Search Bar & Hide Meanings toggle */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-500 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="어휘 또는 뜻 검색..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                />
              </div>

              <button
                onClick={() => setHideMeanings(!hideMeanings)}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
                  hideMeanings
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <i className={`fa-solid ${hideMeanings ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                <span>{hideMeanings ? '뜻 가리기 ON' : '암기 테스트 모드'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vocabulary List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center space-x-2">
                    <i className="fa-solid fa-spell-check"></i>
                    <span>EBS 필수 어휘 ({filteredVocab.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">클릭하여 발음 청취 가능</span>
                </div>

                {filteredVocab.length > 0 ? (
                  filteredVocab.map((item, idx) => {
                    const isMastered = masteredWords.has(item.word);
                    return (
                      <div
                        key={idx}
                        className={`p-4 bg-slate-950/80 hover:bg-slate-950 rounded-xl border transition-all space-y-2 group ${
                          isMastered ? 'border-emerald-500/30 opacity-75' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-base font-bold text-slate-100 font-mono group-hover:text-pink-300 transition-colors">
                              {item.word}
                            </span>
                            {item.pos && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 font-medium">
                                {item.pos}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => toggleMastered(item.word)}
                              className={`p-1.5 transition-colors rounded-lg text-xs ${
                                isMastered ? 'text-emerald-400 hover:bg-emerald-950/50' : 'text-slate-600 hover:text-emerald-400 hover:bg-slate-800'
                              }`}
                              title={isMastered ? '암기 완료 해제' : '암기 완료 체크'}
                            >
                              <i className={`fa-solid ${isMastered ? 'fa-circle-check' : 'fa-circle'}`}></i>
                            </button>
                            <button
                              onClick={() => onSpeak(item.word)}
                              className="text-slate-500 hover:text-pink-400 p-1.5 transition-colors rounded-lg hover:bg-slate-800"
                              title="발음 듣기"
                            >
                              <i className="fa-solid fa-volume-high text-xs"></i>
                            </button>
                          </div>
                        </div>

                        {/* Meaning */}
                        <div className="text-xs text-slate-300 font-medium">
                          {hideMeanings ? (
                            <span
                              className="text-slate-600 bg-slate-900 px-2 py-0.5 rounded italic cursor-pointer hover:text-slate-400"
                              onClick={() => setHideMeanings(false)}
                            >
                              [클릭하여 뜻 확인]
                            </span>
                          ) : (
                            item.meaning
                          )}
                        </div>

                        {/* Synonyms & Antonyms */}
                        {(item.synonym || item.antonym) && !hideMeanings && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900 text-[11px]">
                            {item.synonym && (
                              <span className="text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                <strong className="font-semibold">유:</strong> {item.synonym}
                              </span>
                            )}
                            {item.antonym && (
                              <span className="text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                <strong className="font-semibold">반:</strong> {item.antonym}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Example Sentence */}
                        {item.example && !hideMeanings && (
                          <div className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800/50">
                            💡 "{item.example}"
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 italic p-6 text-center bg-slate-950 rounded-xl border border-slate-800">
                    검색된 어휘가 없습니다.
                  </p>
                )}
              </div>

              {/* Syntax Notes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
                  <i className="fa-solid fa-code"></i>
                  <span>구문 정밀 분석 노트 ({selectedPassage.syntaxNotes?.length || 0})</span>
                </h4>
                {selectedPassage.syntaxNotes?.length > 0 ? (
                  selectedPassage.syntaxNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed space-y-1.5 hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between text-cyan-400 font-bold">
                        <span className="flex items-center space-x-1.5">
                          <i className="fa-solid fa-bolt text-[10px]"></i>
                          <span>구문 분석 포인트 #{idx + 1}</span>
                        </span>
                      </div>
                      <div className="text-slate-300 pt-1">{note}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic p-6 text-center bg-slate-950 rounded-xl border border-slate-800">
                    등록된 구문 노특가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FLASHCARD MODE */}
        {viewMode === 'flashcard' && (
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            {/* Flashcard Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowOnlyUnmastered(!showOnlyUnmastered)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
                    showOnlyUnmastered
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <i className="fa-solid fa-filter"></i>
                  <span>미암기 단어만 ({selectedPassage.vocabList?.length - masteredWords.size || 0}개)</span>
                </button>

                <button
                  onClick={handleShuffleDeck}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-all flex items-center space-x-1.5"
                  title="카드 순서 셔플"
                >
                  <i className="fa-solid fa-shuffle"></i>
                  <span>무작위 섞기</span>
                </button>
              </div>

              <div className="text-slate-400 font-mono text-xs flex items-center space-x-2">
                <span>카드 {deck.length > 0 ? currentIndex + 1 : 0} / {deck.length}</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400 font-bold">암기완료 {masteredWords.size}개</span>
              </div>
            </div>

            {/* Progress Bar */}
            {deck.length > 0 && (
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-pink-500 h-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
                ></div>
              </div>
            )}

            {/* 3D Interactive Flip Card */}
            {currentCard ? (
              <div className="space-y-4">
                <div
                  className="w-full h-80 cursor-pointer select-none"
                  style={{ perspective: '1000px' }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div
                    className="relative w-full h-full duration-500 transition-transform rounded-2xl shadow-2xl"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    {/* Front Side */}
                    <div
                      className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-pink-950/40 border-2 border-pink-500/30 hover:border-pink-500/60 rounded-2xl p-8 flex flex-col items-center justify-between text-center transition-all shadow-xl"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="w-full flex items-center justify-between text-xs text-slate-400">
                        <span className="bg-pink-500/10 text-pink-400 font-mono px-2.5 py-1 rounded-full border border-pink-500/20 font-bold">
                          {currentCard.pos || 'VOCAB'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => toggleMastered(currentCard.word, e)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 transition-all ${
                              masteredWords.has(currentCard.word)
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <i className={`fa-solid ${masteredWords.has(currentCard.word) ? 'fa-check-circle' : 'fa-circle'}`}></i>
                            <span>{masteredWords.has(currentCard.word) ? '암기됨' : '미암기'}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSpeak(currentCard.word);
                            }}
                            className="p-2 bg-slate-800/80 hover:bg-pink-600 text-slate-300 hover:text-white rounded-full transition-all"
                            title="발음 듣기"
                          >
                            <i className="fa-solid fa-volume-high text-xs"></i>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 my-auto">
                        <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                          {currentCard.word}
                        </div>
                      </div>

                      <div className="text-xs text-pink-400/80 font-medium flex items-center space-x-1.5">
                        <i className="fa-solid fa-arrows-rotate animate-spin-slow"></i>
                        <span>클릭하거나 [Space] 키를 눌러 뜻 확인</span>
                      </div>
                    </div>

                    {/* Back Side */}
                    <div
                      className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border-2 border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl p-8 flex flex-col items-center justify-between text-center transition-all shadow-xl"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <div className="w-full flex items-center justify-between text-xs text-slate-400">
                        <span className="bg-cyan-500/10 text-cyan-400 font-mono px-2.5 py-1 rounded-full border border-cyan-500/20 font-bold">
                          MEANING & CONTEXT
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => toggleMastered(currentCard.word, e)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 transition-all ${
                              masteredWords.has(currentCard.word)
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <i className={`fa-solid ${masteredWords.has(currentCard.word) ? 'fa-check-circle' : 'fa-circle'}`}></i>
                            <span>{masteredWords.has(currentCard.word) ? '암기됨' : '미암기'}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSpeak(currentCard.word);
                            }}
                            className="p-2 bg-slate-800/80 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-full transition-all"
                            title="발음 듣기"
                          >
                            <i className="fa-solid fa-volume-high text-xs"></i>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 my-auto w-full px-2">
                        <div className="text-xl sm:text-2xl font-bold text-cyan-300">
                          {currentCard.meaning}
                        </div>

                        {/* Synonyms & Antonyms */}
                        {(currentCard.synonym || currentCard.antonym) && (
                          <div className="flex flex-wrap justify-center gap-2 text-xs pt-2">
                            {currentCard.synonym && (
                              <span className="text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/50">
                                유의어: {currentCard.synonym}
                              </span>
                            )}
                            {currentCard.antonym && (
                              <span className="text-amber-300 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-800/50">
                                반의어: {currentCard.antonym}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Example */}
                        {currentCard.example && (
                          <div className="text-xs text-slate-300 italic bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 max-w-lg mx-auto">
                            💡 "{currentCard.example}"
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-cyan-400/80 font-medium flex items-center space-x-1.5">
                        <i className="fa-solid fa-rotate-left"></i>
                        <span>다시 단어로 가려면 클릭하세요</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Controls & Keyboard Hints */}
                <div className="flex items-center justify-between gap-4 pt-2">
                  <button
                    onClick={handlePrevCard}
                    disabled={deck.length <= 1}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                    <span>이전 카드</span>
                  </button>

                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-6 py-3 bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-pink-950/40 flex items-center space-x-2 transition-all"
                  >
                    <i className="fa-solid fa-repeat"></i>
                    <span>카드 뒤집기</span>
                  </button>

                  <button
                    onClick={handleNextCard}
                    disabled={deck.length <= 1}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all"
                  >
                    <span>다음 카드</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>

                <div className="text-center text-[11px] text-slate-500 flex items-center justify-center space-x-4 pt-1">
                  <span>단축키: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">Space</kbd> 뒤집기</span>
                  <span>|</span>
                  <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">→</kbd> 카드 이동</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <i className="fa-solid fa-circle-check text-4xl text-emerald-400"></i>
                <p className="text-sm text-slate-300 font-bold">모든 단어 학습을 완료하셨습니다!</p>
                <button
                  onClick={() => setShowOnlyUnmastered(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
                >
                  전체 단어 다시 보기
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

