import React, { useState, useRef, useEffect } from 'react';
import { EBSPassage, ChatMessage } from '../types';
import { safeFetchJson } from '../lib/api';
import { recordSocraticQuestion } from '../lib/analytics';
import { auth } from '../lib/firebase';

interface SocraticTabProps {
  selectedPassage: EBSPassage;
  customApiKey: string;
}

export const SocraticTab: React.FC<SocraticTabProps> = ({ selectedPassage, customApiKey }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState<number>(1);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isThinking]);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const currentPromptText = input;
    const userMsg: ChatMessage = { role: 'user', text: input };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setInput('');
    setIsThinking(true);

    try {
      const data = await safeFetchJson('/api/gemini/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: newHistory,
          passage: selectedPassage.passage,
          title: selectedPassage.title,
          lesson: selectedPassage.lesson,
          itemNo: selectedPassage.itemNo,
          translation: selectedPassage.translation,
          customApiKey,
          hintLevel,
        }),
      });

      const botText = data.success ? data.text : `오류: ${data.error || '답변 생성 실패'}`;
      setChatHistory([...newHistory, { role: 'model', text: botText }]);

      // Record Socratic analytics
      recordSocraticQuestion({
        studentEmail: auth.currentUser?.email,
        studentName: auth.currentUser?.displayName,
        passageTitle: selectedPassage.title,
        lesson: selectedPassage.lesson,
        itemNo: selectedPassage.itemNo,
        questionText: currentPromptText,
        hintLevel,
      });
    } catch (err: any) {
      setChatHistory([...newHistory, { role: 'model', text: `오류가 발생했습니다: ${err.message}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 flex flex-col h-[calc(100vh-100px)]">
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
            <i className="fa-solid fa-comments"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              소크라테스 튜터 ({selectedPassage.lesson} {selectedPassage.itemNo})
            </h3>
            <p className="text-xs text-slate-400">정답을 제시하기보다 유도 질문으로 학생의 독해 및 구문적 추론을 이끌어냅니다.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 3-Step Hint Policy Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold px-1.5">힌트 정책:</span>
            {[
              { level: 1, label: '1단계 (문맥 힌트)', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/60' },
              { level: 2, label: '2단계 (구문 힌트)', color: 'border-amber-500/40 text-amber-300 bg-amber-950/60' },
              { level: 3, label: '3단계 (완전 해설)', color: 'border-purple-500/40 text-purple-300 bg-purple-950/60' },
            ].map(item => (
              <button
                key={item.level}
                onClick={() => setHintLevel(item.level)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                  hintLevel === item.level
                    ? item.color
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setChatHistory([])}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 shrink-0"
          >
            대화 초기화
          </button>
        </div>
      </div>

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <i className="fa-solid fa-brain text-4xl mb-3 text-emerald-500/50"></i>
            <h4 className="text-sm font-bold text-slate-300">소크라테스 AI 튜터와의 대화</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              "이 문장에서 주제문은 어디에 있어?", "However 뒷문장의 역접 의미가 뭐야?", "이 문장 직독직해 해석해 볼 테니 봐줘" 등 무엇이든 질문해 보세요!
            </p>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
                  AI
                </div>
              )}
              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed max-w-xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-emerald-500/30 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              AI
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 text-xs text-slate-400 rounded-2xl rounded-tl-none flex items-center space-x-2">
              <i className="fa-solid fa-circle-notch fa-spin text-emerald-400"></i>
              <span>소크라테스 튜터가 생각을 정립하고 있습니다...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Question Chips */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {[
          "📌 이 지문의 주제와 요지를 쉽게 설명해줘",
          "🔍 문장의 주어/동사 구문 및 어법 분석해줘",
          "💡 핵심 어휘와 문맥상 의미를 가르쳐줘",
          "⚡ 역접/연결어의 흐름과 필자의 어조 변화는?"
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInput(chip.replace(/^[📌🔍💡⚡]\s*/, ''));
            }}
            className="text-[11px] bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 transition-all font-medium flex items-center space-x-1"
          >
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      {!auth.currentUser ? (
        <div className="bg-slate-900/90 p-4 rounded-xl border border-rose-500/40 text-center space-y-1 shrink-0">
          <div className="text-xs font-bold text-rose-400 flex items-center justify-center space-x-1.5">
            <i className="fa-solid fa-lock"></i>
            <span>🔒 소크라테스 AI 튜터 3단계 힌트 질의응답은 Google 로그인 후 이용 가능합니다.</span>
          </div>
          <p className="text-[11px] text-slate-400">
            우측 상단 <strong className="text-blue-400">Google 로그인</strong> 후 질문을 입력해 주세요. (@simin.hs.kr 학생 전용)
          </p>
        </div>
      ) : (
        <div className="flex items-center space-x-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="질문이나 구문/어휘/주제 질문을 입력하세요..."
            className="flex-1 bg-slate-900 text-slate-100 text-xs rounded-xl p-3 border border-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={sendMessage}
            disabled={isThinking || !input.trim()}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      )}
    </div>
  );
};
