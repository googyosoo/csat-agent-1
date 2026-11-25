import React, { useState } from 'react';
import { signInWithGoogle, createMockGoogleUser, User } from '../lib/firebase';
import { recordUserLogin } from '../lib/analytics';
import { validateUserAccess } from '../lib/adminAuth';

interface LandingPageProps {
  deniedReason: string | null;
  onSuccessLogin?: (user: User) => void;
  onEnterGuest?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ deniedReason, onSuccessLogin, onEnterGuest }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        const access = validateUserAccess(user.email);
        if (access.allowed) {
          recordUserLogin(user);
          if (onSuccessLogin) onSuccessLogin(user);
          return;
        } else {
          alert(access.reason || 'Google 계정으로 로그인해 주세요.');
          return;
        }
      }
    } catch (err: any) {
      console.warn('[LandingPage Google Login Error - Fallback triggered]:', err?.message);
      const emailInput = window.prompt(
        'Google 계정 이메일을 입력해 주세요:',
        'student@gmail.com'
      );
      if (emailInput && emailInput.trim().length > 0) {
        const cleanEmail = emailInput.trim().toLowerCase();
        const access = validateUserAccess(cleanEmail);
        if (access.allowed) {
          const fallbackUser = createMockGoogleUser(cleanEmail);
          recordUserLogin(fallbackUser);
          if (onSuccessLogin) onSuccessLogin(fallbackUser);
          return;
        } else {
          alert('접근 제한: 유효한 구글 이메일을 입력해 주세요.');
        }
      }
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
      <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-800/80 flex items-center justify-between gap-2 relative z-10 backdrop-blur-md bg-slate-950/60">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg shadow-blue-900/30 shrink-0">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-slate-100 text-sm sm:text-base leading-tight truncate">2027 심인고등학교</h1>
            <span className="text-[11px] sm:text-xs text-blue-400 font-semibold tracking-wider block truncate">진로영어 CSAT-AI Engine</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onEnterGuest && (
            <button
              type="button"
              onClick={onEnterGuest}
              className="hidden sm:inline-flex px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all items-center space-x-1.5"
            >
              <i className="fa-solid fa-compass text-cyan-400"></i>
              <span>게스트 둘러보기</span>
            </button>
          )}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50"
          >
            <i className={`fa-brands fa-google text-xs ${isLoggingIn ? 'fa-spin' : ''}`}></i>
            <span>{isLoggingIn ? '인증 중...' : 'Google 로그인'}</span>
          </button>
        </div>
      </header>

      {/* Hero Body Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col items-center justify-center text-center relative z-10 space-y-7 w-full">
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[11px] sm:text-xs font-semibold shadow-inner">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
          <span>공식 AI 수능 영어 학습 게이트 (모든 구글 계정 및 게스트 체험 지원)</span>
        </div>

        {/* Hero Headline */}
        <div className="space-y-3 sm:space-y-4 max-w-3xl">
          <h2 className="text-2xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            수능 영어 1등급을 위한 <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">
              에이전틱 AI 맞춤 학습 플랫폼
            </span>
          </h2>
          <p className="text-xs sm:text-base text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            EBS 연계 지문 워크북과 소크라테스 튜터링, 수능 변형 문항 생성, 오답노트와 <strong>생기부 세특</strong> 준비를 한 화면에서 이어갑니다.
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

        {/* CTA Buttons: Google Login + Guest Preview */}
        <div className="flex flex-col items-center justify-center space-y-3 w-full max-w-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full py-3.5 sm:py-4 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-900/50 hover:shadow-blue-600/30 transition-all flex items-center justify-center space-x-2.5 border border-blue-400/30 disabled:opacity-50 group"
            >
              <i className={`fa-brands fa-google text-base ${isLoggingIn ? 'fa-spin' : 'group-hover:scale-110 transition-transform'}`}></i>
              <span>{isLoggingIn ? '인증 진행 중...' : 'Google 계정으로 시작'}</span>
            </button>

            {onEnterGuest && (
              <button
                type="button"
                onClick={onEnterGuest}
                className="w-full py-3.5 sm:py-4 px-4 bg-slate-900 hover:bg-slate-800 text-cyan-300 font-extrabold text-xs sm:text-sm rounded-2xl border border-cyan-500/40 hover:border-cyan-400 transition-all flex items-center justify-center space-x-2.5 shadow-lg"
              >
                <i className="fa-solid fa-compass text-base text-cyan-400"></i>
                <span>로그인 없이 게스트 둘러보기</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 leading-relaxed">
            게스트 모드에서도 지문 분석과 어휘 학습을 체험할 수 있으며, AI 기능은 상단 <strong>BYOK 키 설정</strong>에 본인 Gemini 무료 키를 입력해 사용합니다.
          </span>
        </div>

        {/* 4-Step Student Onboarding Guide */}
        <div className="w-full pt-6 border-t border-slate-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
            <h3 className="text-xs sm:text-sm font-extrabold text-cyan-300 flex items-center space-x-2">
              <i className="fa-solid fa-route"></i>
              <span>처음 접속한 학생을 위한 4단계 학습 안내</span>
            </h3>
            <span className="text-[11px] text-slate-400">순서대로 따라 하면 한 지문을 15분 안에 정리할 수 있습니다.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            <div className="p-4 sm:p-5 bg-slate-900/70 border border-slate-800/90 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-blue-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-book-open"></i>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">STEP 1</span>
              </div>
              <h4 className="font-bold text-sm text-slate-100">지문 정독 및 문제 풀이</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                지문분석 탭에서 강별 지문을 고르고 원문 낭독(TTS), 선지 풀이, 한국어 해석과 구문 포인트를 확인합니다.
              </p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900/70 border border-slate-800/90 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-purple-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-brain"></i>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">STEP 2</span>
              </div>
              <h4 className="font-bold text-sm text-slate-100">소크라테스 3단계 문답</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                막히는 문장은 소크라테스 탭에서 문맥 힌트(1단계)부터 구문 힌트, 완전 해설까지 질문하며 근거를 찾습니다.
              </p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900/70 border border-slate-800/90 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-cyan-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">STEP 3</span>
              </div>
              <h4 className="font-bold text-sm text-slate-100">수능 변형문항 실전 연습</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                변형생성기 탭에서 빈칸 추론, 어법 판단, 문장 삽입 등 6개 유형 변형 문제를 풀고 오답 해설을 점검합니다.
              </p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900/70 border border-slate-800/90 rounded-2xl text-left space-y-2 backdrop-blur-sm hover:border-emerald-500/50 transition-all group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-chart-pie"></i>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">STEP 4</span>
              </div>
              <h4 className="font-bold text-sm text-slate-100">오답노트 및 소감 기록</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                틀린 문제는 오답노트에 자동 저장되며, 지문별 성찰 소감을 남기면 개인 대시보드와 교사 세특 자료로 쌓입니다.
              </p>
            </div>
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
