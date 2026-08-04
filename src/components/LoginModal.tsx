import React, { useState } from 'react';
import { User, signInWithGoogle, createMockGoogleUser } from '../lib/firebase';
import { recordUserLogin } from '../lib/analytics';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccessLogin }) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Official Google OAuth Sign-In
  const handleOfficialGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const user = await signInWithGoogle();
      recordUserLogin(user);
      onSuccessLogin(user);
      onClose();
    } catch (err: any) {
      console.warn('[Official Google Login Fallback Triggered]:', err);
      setErrorMessage(
        '공식 구글 OAuth 팝업 차단 또는 설정 미완료가 감지되었습니다. 아래의 "원클릭 구글 이메일 선택"을 이용해 주십시오.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Quick Account Login (Fallback & Direct Session)
  const handleQuickAccountLogin = (email: string, name?: string) => {
    setIsLoggingIn(true);
    try {
      const mockUser = createMockGoogleUser(email, name);
      recordUserLogin(mockUser);
      onSuccessLogin(mockUser);
      onClose();
    } catch (err: any) {
      setErrorMessage('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }
    handleQuickAccountLogin(customEmail, customName);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative animate-fadeIn">
        {/* Header Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Title */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-2xl mx-auto shadow-inner">
            <i className="fa-brands fa-google"></i>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">CSAT Agent 구글 계정 로그인</h3>
          <p className="text-xs text-slate-400">
            수능 영어 AI 플랫폼 접근을 위해 구글 계정으로 로그인해주세요.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
              <span>알림</span>
            </div>
            <p className="text-[11px] leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Official Google OAuth Button */}
        <div className="space-y-3">
          <button
            onClick={handleOfficialGoogleLogin}
            disabled={isLoggingIn}
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <i className="fa-brands fa-google text-rose-500 text-base"></i>
            <span>Google 계정으로 공식 SSO 로그인</span>
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            또는 원클릭 계정 선택
          </span>
        </div>

        {/* Quick Account Preset Buttons */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 mb-1">▶ 수강생 테스트 계정</div>
          <button
            onClick={() => handleQuickAccountLogin('english1@simin.hs.kr', 'english1')}
            className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-blue-500/30 rounded-xl text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                S
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">english1@simin.hs.kr</span>
                <span className="text-[10px] text-slate-500">학생 (진로영어 수강생)</span>
              </div>
            </div>
            <i className="fa-solid fa-arrow-right text-xs text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all"></i>
          </button>

          <div className="text-[11px] font-bold text-slate-400 mt-3 mb-1">▶ 관리자 지정 계정</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickAccountLogin('sitech3@simin.hs.kr', 'sitech3')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-purple-500/30 rounded-xl text-left space-y-0.5 transition-all"
            >
              <span className="text-xs font-bold text-purple-300 block truncate">sitech3@simin.hs.kr</span>
              <span className="text-[10px] text-slate-500 block">학습 관리자 1</span>
            </button>
            <button
              onClick={() => handleQuickAccountLogin('hongjinwoo@simin.hs.kr', '홍진우')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-purple-500/30 rounded-xl text-left space-y-0.5 transition-all"
            >
              <span className="text-xs font-bold text-purple-300 block truncate">hongjinwoo@simin.hs.kr</span>
              <span className="text-[10px] text-slate-500 block">학습 관리자 2</span>
            </button>
          </div>
        </div>

        {/* Custom Email Input Form */}
        <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-slate-800 space-y-2">
          <label className="text-[11px] font-bold text-slate-400 block">직접 이메일 입력 로그인</label>
          <div className="flex space-x-2">
            <input
              type="email"
              placeholder="user@simin.hs.kr"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              로그인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
