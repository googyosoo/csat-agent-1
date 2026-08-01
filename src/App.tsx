import React, { useState, useEffect } from 'react';
import { INITIAL_EBS_DATASET } from './data/ebsDataset';
import { EBSPassage } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LibraryTab } from './components/LibraryTab';
import { OrchestratorTab } from './components/OrchestratorTab';
import { SocraticTab } from './components/SocraticTab';
import { GeneratorTab } from './components/GeneratorTab';
import { VocabTab } from './components/VocabTab';
import { IngestModal } from './components/IngestModal';
import { AdminDashboardTab } from './components/AdminDashboardTab';
import { subscribeToAuth, logout, User } from './lib/firebase';
import { validateUserAccess, ALLOWED_STUDENT_DOMAIN, ADMIN_EMAILS, isAdminUser } from './lib/adminAuth';

import { LandingPage } from './components/LandingPage';
import { MyLearningTab } from './components/MyLearningTab';
import { SUBJECTS } from './data/subjects';
import { recordUserLogin } from './lib/analytics';

export default function App() {
  const [dataset, setDataset] = useState<EBSPassage[]>(INITIAL_EBS_DATASET);
  const [selectedSubjectId, setSelectedSubjectId] = useState('jinro');
  const [activeTab, setActiveTab] = useState('library');
  const [selectedPassage, setSelectedPassage] = useState<EBSPassage>(INITIAL_EBS_DATASET[0]);
  const [filterLesson, setFilterLesson] = useState('ALL');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [deniedReason, setDeniedReason] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('csat_theme_mode') as 'dark' | 'light') || 'dark';
  });

  const isAdmin = authUser ? isAdminUser(authUser.email) : false;

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    const foundSub = SUBJECTS.find(s => s.id === subjectId);
    if (foundSub && foundSub.dataset.length > 0) {
      setDataset(foundSub.dataset);
      setSelectedPassage(foundSub.dataset[0]);
    }
  };

  const handleToggleTheme = (mode: 'dark' | 'light') => {
    setTheme(mode);
    localStorage.setItem('csat_theme_mode', mode);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      if (user) {
        const access = validateUserAccess(user.email);
        if (!access.allowed) {
          setDeniedReason(access.reason || '접근이 허용되지 않는 계정입니다.');
          setAuthUser(null);
          await logout();
          return;
        }
        recordUserLogin(user);
      }
      setDeniedReason(null);
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported in this browser.');
    }
  };

  const handleAddPassage = (newPassage: EBSPassage) => {
    setDataset(prev => [newPassage, ...prev]);
    setSelectedPassage(newPassage);
  };

  // If not logged in, render First-screen Entrance Landing Page
  if (!authUser) {
    return <LandingPage deniedReason={deniedReason} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans transition-all ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Sidebar (Mobile Responsive Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dataset={dataset}
        selectedPassage={selectedPassage}
        setSelectedPassage={setSelectedPassage}
        filterLesson={filterLesson}
        setFilterLesson={setFilterLesson}
        onOpenIngestModal={() => {
          setIsMobileMenuOpen(false);
          setShowIngestModal(true);
        }}
        authUser={authUser}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={handleSelectSubject}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
        <Header
          selectedPassage={selectedPassage}
          isSpeaking={isSpeaking}
          onSpeak={speakText}
          onStopSpeak={stopSpeaking}
          customApiKey={customApiKey}
          setCustomApiKey={setCustomApiKey}
          authUser={authUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
        />

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 sm:pb-8">
          {activeTab === 'mylearning' && (
            <MyLearningTab
              dataset={dataset}
              onSelectPassage={(passageId) => {
                const found = dataset.find((p) => p.id === passageId);
                if (found) {
                  setSelectedPassage(found);
                  setActiveTab('library');
                }
              }}
            />
          )}
          {activeTab === 'library' && (
            <LibraryTab
              selectedPassage={selectedPassage}
              isSpeaking={isSpeaking}
              onSpeak={speakText}
              onStopSpeak={stopSpeaking}
            />
          )}
          {activeTab === 'orchestrator' && (
            <OrchestratorTab selectedPassage={selectedPassage} customApiKey={customApiKey} />
          )}
          {activeTab === 'socratic' && (
            <SocraticTab selectedPassage={selectedPassage} customApiKey={customApiKey} />
          )}
          {activeTab === 'generator' && (
            <GeneratorTab selectedPassage={selectedPassage} customApiKey={customApiKey} />
          )}
          {activeTab === 'vocab' && <VocabTab selectedPassage={selectedPassage} onSpeak={speakText} />}
          {activeTab === 'admin' && <AdminDashboardTab authUser={authUser} />}
        </div>
      </main>

      {/* Ingest Modal */}
      {showIngestModal && (
        <IngestModal
          onClose={() => setShowIngestModal(false)}
          onAddPassage={handleAddPassage}
          customApiKey={customApiKey}
        />
      )}

      {/* Access Denied Modal */}
      {deniedReason && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl mx-auto font-bold border border-rose-500/30">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <h3 className="text-base font-bold text-white">로그인 계정 접근 제한 안내</h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800 font-sans">
              {deniedReason}
            </p>
            <div className="text-[11px] text-slate-400 space-y-1 text-left bg-slate-950/50 p-3 rounded-xl border border-slate-800">
              <div className="font-bold text-slate-300">💡 로그인 허용 정책:</div>
              <div>• <strong>일반 학습자(학생)</strong>: <code className="text-cyan-300 font-mono">@simin.hs.kr</code> 계정 전용</div>
              <div>• <strong>지정 관리자</strong>: 지정 이메일 3개 계정 허용 (도메인 무관)</div>
            </div>
            <button
              onClick={() => setDeniedReason(null)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950/50 transition-all"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
