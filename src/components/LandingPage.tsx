import React, { useState } from 'react';
import { signInWithGoogle, User } from '../lib/firebase';
import { recordUserLogin } from '../lib/analytics';

interface LandingPageProps {
  deniedReason: string | null;
  onSuccessLogin?: (user: User) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ deniedReason, onSuccessLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        recordUserLogin(user);
        if (onSuccessLogin) {
          onSuccessLogin(user);
        }
      }
    } catch (err: any) {
      console.warn('[LandingPage Google Login Error]:', err?.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Decorative Glow Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[30rem] h-[30rem] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between relative z-10 backdrop-blur-md bg-slate-950/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-900/30">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-base leading-tight">2027 심인고등학교</h1>
            <span className="text-xs text-blue-400 font-semibold tracking-wider">진로영어 CSAT-AI Engine</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          <i className={`fa-brands fa-google text-xs ${isLoggingIn ? 'fa-spin' : ''}`}></i>
          <span>{isLoggingIn ? '인증 중...' : 'Google 로그인'}</span>
        </button>
      </header>

      {/* Hero Body Content */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center relative z-10 space-y-8">
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-semibold shadow-inner">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span>심인고등학교 학생 전용 (@simin.hs.kr) 공식 AI 학습 게이트</span>
        </div>

        {/* Hero Headline */}
        <div className="space-y-4 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            수능 영어 1등급을 위한 <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">
              에이전틱 AI 맞춤 학습 플랫폼
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            EBS 수능 연계 지문 정밀 분석부터 소크라테스 메타인지 튜터링, 수능 변형 문제 동적 생성, 
            그리고 개인별 <strong>생기부 세특(세부능력 및 특기사항)</strong> 자동 자산 축적까지 경험하세요.
          </p>
        </div>

        {/* Access Denied Warning Alert */}
        {deniedReason && (
          <div className="w-full max-w-md p-4 bg-rose-950/80 border border-rose-500/60 rounded-2xl text-rose-200 text-xs font-semibold text-center space-y-1 shadow-xl animate-pulse">
            <div className="flex items-center justify-center space-x-2 text-rose-400 font-bold">
              <i className="fa-solid fa-circle-exclamation text-base"></i>
              <span>로그인 접근 제한</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">{deniedReason}</p>
          </div>
        )}

        {/* CTA Large Google Login Button */}
        <div className="flex flex-col items-center justify-center space-y-3 w-full max-w-xs">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-900/50 hover:shadow-blue-600/30 transition-all flex items-center justify-center space-x-3 border border-blue-400/30 disabled:opacity-50 group"
          >
            <i className={`fa-brands fa-google text-lg ${isLoggingIn ? 'fa-spin' : 'group-hover:scale-110 transition-transform'}`}></i>
            <span>{isLoggingIn ? '인증 진행 중...' : 'Google 계정으로 로그인'}</span>
          </button>
          <span className="text-[11px] text-slate-400 font-mono">
            🔒 @simin.hs.kr 전용 계정만 가능
          </span>
        </div>

        {/* 4 Core Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-8 border-t border-slate-800/80">
          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-blue-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-book-open"></i>
            </div>
            <h3 className="font-bold text-sm text-slate-100">지문 정밀 오케스트레이션</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              구문해석, 키워드, 어휘, 문법, 배경지식을 멀티 에이전트가 입체적으로 자동 분석합니다.
            </p>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-purple-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-[#00F2FE]"></i>
              <i className="fa-solid fa-brain"></i>
            </div>
            <h3 className="font-bold text-sm text-slate-100">소크라테스 메타인지 튜터</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              직접 답을 주지 않고 단계별 역질문 힌트로 메타인지적 지문 파악을 유도합니다.
            </p>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-cyan-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <h3 className="font-bold text-sm text-slate-100">수능 변형문제 무한 생성</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              빈칸추론, 문장삽입, 순서배열 등 출제 가능성이 가장 높은 최적화 문항을 자동 생성합니다.
            </p>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <h3 className="font-bold text-sm text-slate-100">개인 맞춤형 진로 대시보드</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              학습자의 활동과 성찰 기록이 대시보드 및 관리자 시스템에 실시간으로 연동 저장됩니다.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/60 text-center text-xs text-slate-500 relative z-10">
        <p>© 2027 Simin High School CSAT English AI Agent Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};
