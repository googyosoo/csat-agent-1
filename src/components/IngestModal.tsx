import React, { useState } from 'react';
import { EBSPassage } from '../types';
import { safeFetchJson } from '../lib/api';

interface IngestModalProps {
  onClose: () => void;
  onAddPassage: (passage: EBSPassage) => void;
  customApiKey: string;
}

export const IngestModal: React.FC<IngestModalProps> = ({ onClose, onAddPassage, customApiKey }) => {
  const [lesson, setLesson] = useState('13강');
  const [itemNo, setItemNo] = useState('01번');
  const [passageText, setPassageText] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleIngest = async () => {
    if (!passageText.trim() || isIngesting) return;
    setIsIngesting(true);
    setErrorMessage(null);

    try {
      const resData = await safeFetchJson('/api/gemini/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: passageText,
          lesson,
          itemNo,
          customApiKey,
        }),
      });

      if (resData.success && resData.data) {
        const newItem: EBSPassage = {
          id: `custom-${Date.now()}`,
          lesson,
          itemNo,
          passage: passageText,
          ...resData.data,
        };

        onAddPassage(newItem);
        onClose();
      } else {
        throw new Error(resData.error || '지문 자동 파싱 실패');
      }
    } catch (err: any) {
      setErrorMessage(`지문 자동 등록 오류: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <i className="fa-solid fa-file-import text-blue-400"></i>
            <span>2027 EBS 신규 지문 AI 자동 분석 & 등록</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-all"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <i className="fa-solid fa-triangle-exclamation text-rose-400 shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">강 번호</label>
            <input
              type="text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
              placeholder="예: 13강"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">문항 번호</label>
            <input
              type="text"
              value={itemNo}
              onChange={(e) => setItemNo(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
              placeholder="예: 01번"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">영어 지문 원문 (Paste English Passage)</label>
          <textarea
            rows={6}
            value={passageText}
            onChange={(e) => setPassageText(e.target.value)}
            placeholder="EBS 수능완성 원문 텍스트를 붙여넣으세요..."
            className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
          ></textarea>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700"
          >
            취소
          </button>
          <button
            onClick={handleIngest}
            disabled={isIngesting || !passageText.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            <i className={`fa-solid ${isIngesting ? 'fa-spinner fa-spin' : 'fa-brain'}`}></i>
            <span>{isIngesting ? 'AI 자동 분석 중...' : 'AI로 자동 등록'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
