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
import { subscribeToAuth, User } from './lib/firebase';

export default function App() {
  const [dataset, setDataset] = useState<EBSPassage[]>(INITIAL_EBS_DATASET);
  const [activeTab, setActiveTab] = useState('library');
  const [selectedPassage, setSelectedPassage] = useState<EBSPassage>(INITIAL_EBS_DATASET[0]);
  const [filterLesson, setFilterLesson] = useState('ALL');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
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
      alert('이 브라우저는 음성 합성을 지원하지 않습니다.');
    }
  };

  const handleAddPassage = (newPassage: EBSPassage) => {
    setDataset(prev => [newPassage, ...prev]);
    setSelectedPassage(newPassage);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dataset={dataset}
        selectedPassage={selectedPassage}
        setSelectedPassage={setSelectedPassage}
        filterLesson={filterLesson}
        setFilterLesson={setFilterLesson}
        onOpenIngestModal={() => setShowIngestModal(true)}
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
        />

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  );
}
