import React, { useState } from 'react';
import { EBSPassage } from '../types';
import { User, logout } from '../lib/firebase';
import { LoginModal } from './LoginModal';

interface HeaderProps {
  selectedPassage: EBSPassage;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onStopSpeak: () => void;
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  authUser: User | null;
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
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  activeTab = 'library',
  setActiveTab,
  isAdmin = false,
  onSuccessLogin,
}) => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleGoogleLoginClick = () => {
    setShowLoginModal(true);
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

        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          <div className="hidden xl:flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-emerald-500/30 space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-medium text-emerald-300">서버 시스템 연동 (유료 키 입력 불필요)</span>
          </div>

          <div className="hidden md:flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono text-slate-400">csat-ai-agent</span>
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
              <button
                onClick={handleGoogleLoginClick}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[11px] sm:text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-blue-900/30 shrink-0"
                title="Google 계정 로그인"
              >
                <i className="fa-brands fa-google text-xs"></i>
                <span>Google 로그인</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccessLogin={(user) => {
          if (onSuccessLogin) {
            onSuccessLogin(user);
          }
        }}
      />

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
    </div>
  );
};

