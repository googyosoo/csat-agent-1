import React from 'react';
import { EBSPassage } from '../types';
import { User } from '../lib/firebase';
import { isAdminUser } from '../lib/adminAuth';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dataset: EBSPassage[];
  selectedPassage: EBSPassage;
  setSelectedPassage: (passage: EBSPassage) => void;
  filterLesson: string;
  setFilterLesson: (lesson: string) => void;
  onOpenIngestModal: () => void;
  authUser?: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  dataset,
  selectedPassage,
  setSelectedPassage,
  filterLesson,
  setFilterLesson,
  onOpenIngestModal,
  authUser,
}) => {
  const filteredPassages = filterLesson === 'ALL'
    ? dataset
    : dataset.filter(p => p.lesson === filterLesson);

  const lessons = ['ALL', '08강', '09강', '10강', '11강', '12강'];
  const isAdmin = authUser ? isAdminUser(authUser.email) : false;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-20 shrink-0 h-screen">
      <div>
        {/* App Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-tight">2027 진로영어</h1>
            <span className="text-xs text-blue-400 font-semibold tracking-wider">CSAT Agent AI</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="p-3 space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'library' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-book-open w-5 text-center"></i>
            <span>지문 분석 워크북</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orchestrator')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'orchestrator' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-network-wired w-5 text-center"></i>
            <span>에이전틱 오케스트레이터</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('socratic')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'socratic' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-brain w-5 text-center"></i>
            <span>소크라테스 튜터링</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'generator' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-wand-magic-sparkles w-5 text-center"></i>
            <span>AI 변형문항 생성기</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocab')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'vocab' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-layer-group w-5 text-center"></i>
            <span>어휘 & 구문 보관함</span>
          </button>

          {/* Admin Dashboard Navigation */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all border border-purple-500/30 ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50'
                  : 'text-purple-300 hover:bg-purple-950/40 hover:text-purple-200'
              }`}
            >
              <i className="fa-solid fa-chart-line w-5 text-center text-purple-400"></i>
              <span>학습 관리자 대시보드</span>
            </button>
          )}
        </nav>
      </div>

      {/* Passage Selector & Add New Passage */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenIngestModal}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xs rounded-lg shadow hover:opacity-90 transition-all flex items-center justify-center space-x-2"
          >
            <i className="fa-solid fa-plus"></i>
            <span>새 지문 (13강~) 자동 등록</span>
          </button>
        )}

        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <label className="block text-[11px] font-bold text-slate-400 mb-1">강별 필터 선택</label>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {lessons.map(ls => (
              <button
                key={ls}
                onClick={() => setFilterLesson(ls)}
                className={`text-[10px] py-1 rounded font-bold transition-all ${
                  filterLesson === ls ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {ls}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-bold text-slate-400 mb-1">지문 선택 ({filteredPassages.length}개)</label>
          <select
            className="w-full bg-slate-900 text-slate-200 text-xs rounded p-1.5 border border-slate-700 focus:outline-none focus:border-blue-500"
            value={selectedPassage.id}
            onChange={(e) => {
              const found = dataset.find(p => p.id === e.target.value);
              if (found) {
                setSelectedPassage(found);
              }
            }}
          >
            {filteredPassages.length > 0 ? (
              filteredPassages.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.lesson} {p.itemNo}] {p.title.slice(0, 16)}...
                </option>
              ))
            ) : (
              <option disabled>데이터가 없습니다.</option>
            )}
          </select>
        </div>
      </div>
    </aside>
  );
};
