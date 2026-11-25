import React, { useState } from 'react';
import { EBSPassage } from '../types';
import { User, signInWithGoogle, createMockGoogleUser, logout } from '../lib/firebase';
import { recordUserLogin } from '../lib/analytics';
import { validateUserAccess } from '../lib/adminAuth';

interface HeaderProps {
  selectedPassage: EBSPassage;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onStopSpeak: () => void;
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  authUser: User | null;
  isGuestMode?: boolean;
  onExitGuest?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: (mode: 'dark' | 'light') => void;
  onOpenMobileMenu?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  isAdmin?: boolean;
  onSuccessLogin?: (user: User) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedPassage,
  isSpeaking,
  onSpeak,
  onStopSpeak,
  customApiKey,
  setCustomApiKey,
  authUser,
  isGuestMode = false,
  onExitGuest,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  activeTab = 'library',
  setActiveTab,
  isAdmin = false,
  onSuccessLogin,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showByokModal, setShowByokModal] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState(customApiKey);
  const [byokNotice, setByokNotice] = useState<string | null>(null);

  const handleOpenByok = () => {
    setDraftApiKey(customApiKey);
    setByokNotice(null);
    setShowByokModal(true);
  };

  const handleSaveByok = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftApiKey.trim();
    if (cleaned && !cleaned.startsWith('AIza')) {
      setByokNotice('Google AI Studio에서 발급한 Gemini API 키(AIza... 형식)인지 확인해 주세요.');
      return;
    }
    setCustomApiKey(cleaned);
    setByokNotice(cleaned ? '브라우저에 BYOK 키가 저장되었습니다.' : '입력된 BYOK 키가 삭제되었습니다.');
    setTimeout(() => {
      setShowByokModal(false);
      setByokNotice(null);
    }, 600);
  };

  const handleGoogleLoginClick = async () => {
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
      console.warn('[Header Google Login Error - Fallback triggered]:', err?.message);
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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      console.error('[Logout Error]:', err?.message);
    }
  };

  const tabs = [
    { id: 'mylearning', name: '나만의 학습/오답', icon: 'fa-bullseye' },
    { id: 'library', name: '지문분석', icon: 'fa-book-open' },
    { id: 'orchestrator', name: '오케스트레이터', icon: 'fa-network-wired' },
    { id: 'socratic', name: '소크라테스', icon: 'fa-brain' },
    { id: 'generator', name: '변형생성기', icon: 'fa-wand-magic-sparkles' },
    { id: 'vocab', name: '어휘보관함', icon: 'fa-layer-group' },
    { id: 'admin', name: isAdmin ? '관리자 대시보드' : '내 학습 대시보드', icon: 'fa-chart-line' },
  ];

  return (
    <div className="flex flex-col shrink-0 z-10 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <header className="h-14 px-3 sm:px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 truncate">
          {/* Mobile Menu Hamburger Button */}
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="md:hidden px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1 shadow shrink-0 transition-all"
              title="전체 메뉴 및 지문 선택 목록 열기"
            >
              <i className="fa-solid fa-bars"></i>
              <span>메뉴</span>
            </button>
          )}

          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px] sm:text-xs border border-blue-500/30 shrink-0">
            {selectedPassage.lesson} {selectedPassage.itemNo}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-400 shrink-0 hidden sm:inline">[{selectedPassage.type}]</span>
          <h2 className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[120px] sm:max-w-md">{selectedPassage.title}</h2>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          {/* BYOK Gemini API Key Button */}
          <button
            type="button"
            onClick={handleOpenByok}
            className={`px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 transition-all shrink-0 ${
              customApiKey
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950'
                : 'bg-amber-950/50 border-amber-500/40 text-amber-300 hover:bg-amber-950'
            }`}
            title="본인 Google Gemini 무료 API 키(BYOK) 설정"
          >
            <i className="fa-solid fa-key text-[10px]"></i>
            <span className="hidden sm:inline">{customApiKey ? 'BYOK 키 연결됨' : 'BYOK 키 설정'}</span>
            <span className="sm:hidden">{customApiKey ? 'BYOK' : '키'}</span>
          </button>

          <div className="hidden xl:flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono text-slate-400">gemini-2.5-flash</span>
          </div>

          {/* Desktop TTS Reading Button */}
          <div className="hidden md:block">
            {isSpeaking ? (
              <button
                onClick={onStopSpeak}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center space-x-1.5 transition-all animate-pulse"
                title="음성 리딩 즉시 멈춤"
              >
                <i className="fa-solid fa-circle-stop"></i>
                <span>리딩 멈춤</span>
              </button>
            ) : (
              <button
                onClick={() => onSpeak(selectedPassage.passage)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all"
                title="지문 전체 음성 합성 리딩 시작"
              >
                <i className="fa-solid fa-volume-high text-cyan-400"></i>
                <span>지문 리딩 (TTS)</span>
              </button>
            )}
          </div>

          {/* Theme Mode Selector (Dark / Light) */}
          <div className="bg-slate-950 p-0.5 rounded-xl border border-slate-800 flex items-center space-x-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleTheme('dark')}
              className={`px-2 py-1 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center space-x-1 transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/30 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="다크 모드 적용"
            >
              <i className="fa-solid fa-moon text-[10px] sm:text-[11px] text-amber-400"></i>
              <span className="hidden xs:inline">다크</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme('light')}
              className={`px-2 py-1 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center space-x-1 transition-all ${
                theme === 'light'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="일반(라이트) 모드 적용"
            >
              <i className="fa-solid fa-sun text-[10px] sm:text-[11px] text-amber-300"></i>
              <span className="hidden xs:inline">일반</span>
            </button>
          </div>

          {/* Header Google SSO Login / User Profile */}
          <div className="pl-1 sm:pl-2 border-l border-slate-800 flex items-center space-x-2">
            {authUser ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'User'}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-blue-400 shrink-0 no-invert"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-[11px] sm:text-xs font-bold text-slate-200 hidden sm:inline truncate max-w-[100px]">
                  {authUser.displayName || authUser.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold rounded-md border border-slate-700 transition-all shrink-0"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 shrink-0">
                {isGuestMode && onExitGuest && (
                  <button
                    type="button"
                    onClick={onExitGuest}
                    className="hidden sm:inline-flex px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold rounded-lg border border-cyan-500/30 transition-all shrink-0"
                    title="첫 화면 안내로 돌아가기"
                  >
                    첫 화면
                  </button>
                )}
                <button
                  onClick={handleGoogleLoginClick}
                  disabled={isLoggingIn}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[11px] sm:text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-blue-900/30 disabled:opacity-50 shrink-0"
                  title="Google 계정 로그인"
                >
                  <i className={`fa-brands fa-google text-xs ${isLoggingIn ? 'fa-spin' : ''}`}></i>
                  <span className="hidden xs:inline">{isLoggingIn ? '인증중...' : '로그인'}</span>
                  <span className="xs:hidden">{isLoggingIn ? '...' : '로그인'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Quick Tab Navigation Bar */}
      {setActiveTab && (
        <div className="md:hidden px-2 py-1.5 bg-slate-950/90 border-t border-slate-800 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-850'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-[11px]`}></i>
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* BYOK Gemini API Key Modal */}
      {showByokModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                  <i className="fa-solid fa-key"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Gemini API 키 직접 입력 (BYOK)</h3>
                  <p className="text-[11px] text-slate-400">무료 등급 모델(`gemini-2.5-flash`) 우선 사용</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowByokModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveByok} className="space-y-3">
              <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 leading-relaxed">
                <p>소크라테스 문답, 변형문항 생성, 세특 초안 생성 시 입력한 본인 키를 요청에만 사용합니다.</p>
                <p className="text-[11px] text-slate-400">
                  키는 브라우저 저장소(`localStorage`)에만 보관되며 소스 코드나 Git에 저장되지 않습니다.
                </p>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-[11px] text-cyan-400 hover:underline font-semibold"
                >
                  <span>Google AI Studio에서 무료 API 키 발급하기</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                </a>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={draftApiKey}
                  onChange={(e) => setDraftApiKey(e.target.value)}
                  placeholder="AIza... 로 시작하는 본인 키 입력"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {byokNotice && (
                <div className="text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-2">
                  {byokNotice}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftApiKey('');
                    setCustomApiKey('');
                    setByokNotice('저장된 BYOK 키를 비웠습니다.');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  키 지우기
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowByokModal(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

