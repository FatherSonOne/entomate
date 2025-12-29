import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";
import { MeetingsView } from './src/components/MeetingsView';
import { ProjectsView } from './src/components/ProjectsView';
import { AskAssistantView } from './src/components/AskAssistantView';
import { AutomationsView } from './src/components/AutomationsView';
import { AgentsView } from './src/components/AgentsView';
import { SearchView } from './src/components/SearchView';
import { SettingsView } from './src/components/SettingsView';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { CustomerHealthDashboard } from './src/phase3/components';
import { ThemeProvider } from './src/context/ThemeContext';
import { ThemeToggle } from './src/components/ThemeToggle';
import { CommandPalette } from './src/components/CommandPalette';
import { KeyboardShortcutsHelp } from './src/components/KeyboardShortcutsHelp';
import { DailyBriefing } from './src/components/DailyBriefing';
import { KanbanBoard } from './src/components/KanbanBoard';
import { useKeyboardShortcuts, getModKey } from './src/hooks/useKeyboardShortcuts';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
             resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error("Failed to read blob"));
        }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- AUDIO UTILS FOR LIVE API & TTS ---
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- MOCK DATA FOR INBOX ---
const MOCK_EMAILS = [
  {
    id: 1,
    sender: "Sarah Chen (Product)",
    subject: "URGENT: Q3 Roadmap Adjustments Required",
    preview: "We need to cut the mobile feature set to make the deadline. Please review...",
    body: "Hi Team,\n\nBased on the latest engineering estimates, we are at risk of missing the Q3 launch date if we proceed with the full mobile feature set. I propose we cut the 'Offline Mode' and 'Advanced Analytics' features for the MVP.\n\nWe need a decision by EOD today to adjust the sprint planning.\n\nBest,\nSarah",
    time: "10:30 AM",
    priority: "high",
    read: false
  },
  {
    id: 2,
    sender: "Legal Team",
    subject: "Contract Review: Acme Corp Partnership",
    preview: "Attached is the revised MSA for the Acme Corp deal. Major changes in liability...",
    body: "Hello,\n\nPlease review the attached MSA for the Acme Corp partnership. They have pushed back on the liability cap, asking for 3x instead of the standard 1x.\n\nLet me know if this is acceptable from a business risk perspective.\n\nRegards,\nLegal",
    time: "09:15 AM",
    priority: "high",
    read: true
  },
  {
    id: 3,
    sender: "DevOps Alert",
    subject: "Production DB Latency Warning",
    preview: "[WARN] P99 Latency > 500ms on primary-db-cluster-01...",
    body: "Automated Alert:\n\nPrimary Database Cluster is experiencing elevated latency. Current P99 is 520ms (Threshold: 300ms).\n\nAuto-scaling has been triggered. Investigation recommended.",
    time: "08:45 AM",
    priority: "medium",
    read: false
  },
];

// --- COMPONENTS ---

// 0. DASHBOARD HOME
const DashboardHome = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Top Row: System Status & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="cmf-card col-span-2 flex flex-col justify-between group cursor-pointer border border-transparent hover:border-gray-200 transition-all bg-white border border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="font-mono text-xs text-gray-400 uppercase tracking-widest block mb-2">System Status</span>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-bold tracking-tight text-gray-900">Gemini 2.5 Flash</h3>
                                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold font-mono tracking-wide uppercase">Operational</span>
                            </div>
                        </div>
                        <div className="w-3 h-3 bg-[#2563EB] rounded-full animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>
                    </div>
                    
                    {/* Visualizer Bars */}
                    <div className="h-24 flex items-end gap-1.5 opacity-80">
                        {[40, 70, 45, 90, 60, 80, 50, 65, 40, 30, 80, 60, 45, 75, 50, 90, 30, 50, 70, 40].map((h, i) => (
                            <div 
                                key={i} 
                                className="flex-1 bg-gray-200 rounded-sm group-hover:bg-[#2563EB] transition-all duration-500 ease-in-out" 
                                style={{ height: `${h}%`, transitionDelay: `${i * 20}ms` }}
                            ></div>
                        ))}
                    </div>
                </div>

                <div className="cmf-card dark flex flex-col justify-between">
                    <div>
                        <span className="font-mono text-xs text-gray-500 uppercase tracking-widest block mb-4">Inbox Priority</span>
                        <div className="text-6xl font-bold mb-1 font-mono tracking-tighter">03</div>
                        <div className="text-gray-400 text-sm font-medium">Critical Items</div>
                    </div>
                    <button 
                        onClick={() => setActiveTab('inbox')}
                        className="mt-8 w-full py-3 rounded-full border border-gray-800 hover:bg-gray-900 hover:border-gray-700 text-sm font-bold transition-all flex items-center justify-center gap-2 group"
                    >
                        Review Now 
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                </div>
            </div>

            {/* Middle Row: Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => setActiveTab('meetings')} className="bg-gray-50 p-6 rounded-[24px] border border-transparent hover:border-gray-200 transition-all cursor-pointer group flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                    </div>
                    <div>
                        <div className="font-bold text-sm mb-1 text-gray-900">Meetings</div>
                        <div className="text-xs text-gray-500 font-mono">RECORD</div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('projects')} className="bg-gray-50 p-6 rounded-[24px] border border-transparent hover:border-gray-200 transition-all cursor-pointer group flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                        <div className="font-bold text-sm mb-1 text-gray-900">Projects</div>
                        <div className="text-xs text-gray-500 font-mono">MANAGE</div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('ask-assistant')} className="bg-gray-50 p-6 rounded-[24px] border border-transparent hover:border-gray-200 transition-all cursor-pointer group flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div>
                        <div className="font-bold text-sm mb-1 text-gray-900">Ask Assistant</div>
                        <div className="text-xs text-gray-500 font-mono">Q&A</div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('automations')} className="bg-gray-50 p-6 rounded-[24px] border border-transparent hover:border-gray-200 transition-all cursor-pointer group flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                    <div>
                        <div className="font-bold text-sm mb-1 text-gray-900">Automations</div>
                        <div className="text-xs text-gray-500 font-mono">AUTOMATE</div>
                    </div>
                </div>
            </div>

            {/* Customer Health Dashboard */}
            <CustomerHealthDashboard />

            {/* Daily Briefing Widget */}
            <DailyBriefing onNavigate={setActiveTab} />

            {/* Bottom: Recent Activity List */}
            <div className="bg-[#FAFAFA] rounded-[24px] p-8 flex-1 min-h-[300px]">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-mono text-xs uppercase tracking-wider text-gray-500">Recent Activity</h4>
                    <button className="text-xs font-bold hover:text-[#2563EB] transition-colors">VIEW ALL</button>
                </div>

                <div className="space-y-3">
                    {[
                        { title: "Veo Generation: 'Cyberpunk City'", type: "Video", time: "2m ago", icon: "video" },
                        { title: "Meeting Summary: Q3 Sync", type: "Text", time: "1h ago", icon: "file-text" },
                        { title: "Image Edit: Product Shot 04", type: "Image", time: "3h ago", icon: "image" },
                        { title: "Live Session: Brainstorming", type: "Audio", time: "Yesterday", icon: "mic" }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl flex items-center justify-between hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-gray-100 group">
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:text-[#2563EB] transition-colors">
                                    <i className={`fa-solid fa-${item.icon}`}></i>
                                </div>
                                <div>
                                    <h5 className="font-bold text-sm mb-1 text-gray-900">{item.title}</h5>
                                    <p className="text-gray-400 text-xs font-mono">{item.type} • {item.time}</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-300 group-hover:border-[#2563EB] group-hover:text-[#2563EB] transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// 1. INBOX VIEW (Existing)
const InboxView = () => {
  const [selectedEmail, setSelectedEmail] = useState(MOCK_EMAILS[0]);
  const [briefing, setBriefing] = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const generateBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const importantEmails = MOCK_EMAILS.filter(e => e.priority === 'high' || e.priority === 'medium');
      const prompt = `
        You are an executive assistant using the 'Nothing' design language: precise, industrial, and minimal.
        Analyze these emails and generate a "Morning Briefing".
        1. Identify the top 3 critical actions required.
        2. Summarize the risks.
        3. Use a monospaced, technical tone. 
        Emails: ${JSON.stringify(importantEmails.map(e => ({ from: e.sender, subject: e.subject, body: e.body })))}
      `;
      // Use standard Flash for text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      setBriefing(response.text || "No briefing generated.");
    } catch (e) {
      console.error(e);
      setBriefing("Error generating briefing. System offline.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-[#2563EB] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setViewMode('kanban')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'kanban'
              ? 'bg-[#2563EB] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Kanban Board
        </button>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard />
      ) : (
      <div className="flex gap-6 overflow-hidden flex-1">
      <div className="w-1/3 bg-[#FAFAFA] rounded-[24px] p-4 flex flex-col gap-3 overflow-y-auto">
        <div className="flex justify-between items-center px-2 mb-2">
            <span className="font-mono text-xs uppercase text-gray-400 tracking-widest">Action Items ({MOCK_EMAILS.length})</span>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full"></div>
        </div>
        {MOCK_EMAILS.map(email => (
          <div key={email.id} onClick={() => setSelectedEmail(email)} className={`p-5 rounded-2xl cursor-pointer transition-all border ${selectedEmail.id === email.id ? 'bg-white shadow-lg border-transparent' : 'bg-transparent border-transparent hover:bg-white hover:border-gray-100'}`}>
            <div className="flex justify-between mb-2">
               <span className={`font-mono text-xs ${email.priority === 'high' ? 'text-[#2563EB]' : 'text-gray-400'}`}>{email.priority === 'high' ? '● URGENT' : '○ ' + email.priority.toUpperCase()}</span>
               <span className="font-mono text-xs text-gray-400">{email.time}</span>
            </div>
            <h4 className="font-bold text-sm mb-1 leading-tight">{email.sender}</h4>
            <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="cmf-card dark flex-shrink-0 min-h-[200px] flex flex-col justify-between">
           <div className="flex justify-between items-start">
              <span className="font-mono text-xs text-gray-400 uppercase tracking-widest">AI Executive Briefing</span>
              <button onClick={generateBriefing} disabled={loadingBriefing} className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center hover:bg-gray-800 disabled:opacity-50">
                {loadingBriefing ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9"/></svg>}
              </button>
           </div>
           <div className="mt-4 font-mono text-sm leading-relaxed overflow-y-auto max-h-[150px] pr-2 scrollbar-hide">
              {briefing ? <div className="whitespace-pre-line text-gray-200">{briefing}</div> : <div className="text-gray-400">System awaiting command. Click to analyze inbox priorities.</div>}
           </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[24px] p-8 flex-1 overflow-y-auto relative">
           <div className="mb-8 pr-32">
              <h2 className="text-2xl font-bold mb-4">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">{selectedEmail.sender[0]}</div>
                  <div><div className="font-bold text-sm">{selectedEmail.sender}</div><div className="font-mono text-xs text-gray-400">{selectedEmail.time}</div></div>
              </div>
           </div>
           <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-line font-medium">{selectedEmail.body}</div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};

// 2. ASSISTANT VIEW (Chat, Search, Maps, Thinking, Fast)
const AssistantView = () => {
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string, grounding?: any}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Modes: 'fast' (Lite), 'smart' (Pro+Thinking), 'grounding' (Search/Maps)
  const [mode, setMode] = useState<'fast' | 'smart' | 'grounding'>('fast');
  // Tools toggle for grounding
  const [useSearch, setUseSearch] = useState(true);
  const [useMaps, setUseMaps] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const userMsg = input;
    setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
    setInput("");

    try {
      let model = 'gemini-2.5-flash-lite'; // Default Fast
      let config: any = {};

      if (mode === 'smart') {
        model = 'gemini-3-pro-preview';
        // Thinking Budget 32k
        config.thinkingConfig = { thinkingBudget: 32768 }; 
      } else if (mode === 'grounding') {
        model = 'gemini-2.5-flash';
        const tools = [];
        if (useSearch) tools.push({ googleSearch: {} });
        if (useMaps) tools.push({ googleMaps: {} });
        config.tools = tools;
      }

      const response = await ai.models.generateContent({
        model,
        contents: userMsg,
        config
      });

      const text = response.text || "No response generated.";
      const grounding = response.candidates?.[0]?.groundingMetadata;
      
      setMessages(prev => [...prev, {role: 'model', text, grounding}]);
    } catch (e: any) {
      setMessages(prev => [...prev, {role: 'model', text: `Error: ${e.message}`}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[24px] overflow-hidden border border-gray-100">
      {/* Header / Controls */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex gap-2">
            <button onClick={() => setMode('fast')} className={`px-4 py-2 rounded-full text-xs font-bold font-mono transition-colors ${mode === 'fast' ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 hover:bg-gray-200'}`}>FAST (Lite)</button>
            <button onClick={() => setMode('smart')} className={`px-4 py-2 rounded-full text-xs font-bold font-mono transition-colors ${mode === 'smart' ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 hover:bg-gray-200'}`}>THINK (Pro)</button>
            <button onClick={() => setMode('grounding')} className={`px-4 py-2 rounded-full text-xs font-bold font-mono transition-colors ${mode === 'grounding' ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 hover:bg-gray-200'}`}>WEB (Search/Maps)</button>
        </div>
        {mode === 'grounding' && (
           <div className="flex gap-2 text-xs font-mono">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} /> Search</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={useMaps} onChange={e => setUseMaps(e.target.checked)} /> Maps</label>
           </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'}`}>
                {m.text}
                {m.grounding?.groundingChunks && (
                    <div className="mt-2 pt-2 border-t border-gray-300/20 text-xs opacity-70">
                        {m.grounding.groundingChunks.map((chunk: any, idx: number) => {
                            if (chunk.web?.uri) return <div key={idx}><a href={chunk.web.uri} target="_blank" className="underline">{chunk.web.title}</a></div>;
                            if (chunk.maps?.uri) return <div key={idx}><a href={chunk.maps.uri} target="_blank" className="underline">{chunk.maps.title}</a></div>; // Maps support
                            return null;
                        })}
                    </div>
                )}
             </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-gray-100 p-4 rounded-2xl animate-pulse text-xs font-mono">Thinking...</div></div>}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
         <input 
            className="flex-1 bg-gray-50 border-0 rounded-full px-6 py-3 focus:ring-2 focus:ring-[#2563EB] outline-none font-medium"
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
         />
         <button onClick={sendMessage} className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center text-white hover:bg-[#1d4ed8] transition-colors">
            <i className="fa-solid fa-arrow-up"></i>
         </button>
      </div>
    </div>
  );
};

// 3. MEETINGS VIEW (OLD - replaced by src/components/MeetingsView.tsx)
const MeetingsViewOld = () => {
    const [meetingUrl, setMeetingUrl] = useState("");
    const [botName, setBotName] = useState("Gemini Notetaker");
    const [status, setStatus] = useState<'idle' | 'connecting' | 'recording' | 'processing'>('idle');
    const [duration, setDuration] = useState(0);

    // Mock scheduled meetings
    const scheduled = [
        { id: 1, title: "Q3 Product Roadmap Review", time: "10:00 AM - 11:00 AM", platform: "Google Meet", url: "meet.google.com/abc-defg-hij" },
        { id: 2, title: "Design Sync: Mobile App", time: "1:00 PM - 1:30 PM", platform: "Zoom", url: "zoom.us/j/123456789" },
        { id: 3, title: "Client Kickoff: Acme Corp", time: "3:00 PM - 4:00 PM", platform: "Teams", url: "teams.microsoft.com/l/meetup-join/..." }
    ];

    useEffect(() => {
        let interval: any;
        if (status === 'recording') {
            interval = setInterval(() => setDuration(prev => prev + 1), 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleJoin = () => {
        if (!meetingUrl) return;
        setStatus('connecting');
        setTimeout(() => setStatus('recording'), 2000); // Simulate connection delay
    };

    const handleStop = () => {
        setStatus('processing');
        // Simulate processing time
        setTimeout(() => {
            setStatus('idle');
            setMeetingUrl("");
            setDuration(0);
        }, 2000);
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Active Meeting Card */}
            <div className={`cmf-card transition-all duration-500 ${status === 'idle' ? 'dark' : (status === 'processing' ? 'bg-gray-100 text-black' : 'bg-[#2563EB] text-white')}`}>
                 <div className="flex justify-between items-start mb-8">
                    <div>
                        <span className={`font-mono text-xs uppercase tracking-widest opacity-70 mb-2 block ${status === 'processing' ? 'text-gray-500' : 'text-gray-400'}`}>
                            {status === 'idle' ? 'AI Bot Control' : (status === 'connecting' ? 'Establishing Connection...' : (status === 'processing' ? 'Post-Meeting' : 'Live Session'))}
                        </span>
                        <h3 className="text-3xl font-bold">
                            {status === 'idle' && 'Deploy Meeting Bot'}
                            {status === 'connecting' && 'Connecting...'}
                            {status === 'recording' && 'Recording in progress'}
                            {status === 'processing' && 'Processing Transcript...'}
                        </h3>
                    </div>
                    {status === 'recording' && (
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="font-mono text-sm font-bold">{formatTime(duration)}</span>
                        </div>
                    )}
                     {status === 'processing' && (
                        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                    )}
                </div>

                {status === 'idle' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-2 text-gray-400">Meeting URL</label>
                                <input 
                                    value={meetingUrl}
                                    onChange={(e) => setMeetingUrl(e.target.value)}
                                    placeholder="paste_meeting_link_here" 
                                    className="w-full bg-[#262626] border-none rounded-xl p-4 text-white placeholder-gray-600 font-mono text-sm focus:ring-1 focus:ring-gray-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-2 text-gray-400">Bot Name</label>
                                <input 
                                    value={botName}
                                    onChange={(e) => setBotName(e.target.value)}
                                    className="w-full bg-[#262626] border-none rounded-xl p-4 text-white font-mono text-sm focus:ring-1 focus:ring-gray-500 outline-none" 
                                />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button 
                                onClick={handleJoin}
                                disabled={!meetingUrl}
                                className="w-full py-4 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <div className="w-2 h-2 bg-[#2563EB] rounded-full"></div>
                                Join Meeting
                            </button>
                        </div>
                    </div>
                ) : status === 'processing' ? (
                    <div className="flex items-end h-32">
                        <p className="text-gray-600 font-mono text-sm">AI is summarizing key decisions and action items...</p>
                    </div>
                ) : (
                    <div className="flex items-end justify-between h-32">
                         <div className="font-mono text-sm opacity-80">
                            Bot: {botName}<br/>
                            Target: {meetingUrl}<br/>
                            Status: {status === 'connecting' ? 'Negotiating handshake...' : 'Capturing audio & video'}
                         </div>
                         <button 
                            onClick={handleStop}
                            className="px-8 py-3 bg-white text-[#2563EB] rounded-full font-bold hover:bg-gray-100 transition-colors"
                        >
                            {status === 'connecting' ? 'Cancel' : 'Stop Recording'}
                        </button>
                    </div>
                )}
            </div>

            {/* Scheduled List */}
            <div className="flex-1 bg-white border border-gray-100 rounded-[24px] p-8 overflow-hidden flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="font-mono text-xs uppercase tracking-wider text-gray-500">Scheduled Today</h4>
                    <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
                
                <div className="space-y-4 overflow-y-auto">
                    {scheduled.map(meeting => (
                        <div key={meeting.id} className="p-5 border border-gray-100 rounded-2xl hover:border-gray-300 transition-all group">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold uppercase text-gray-500">{meeting.platform}</span>
                                        <span className="font-mono text-xs text-gray-400">{meeting.time}</span>
                                    </div>
                                    <h5 className="font-bold text-lg">{meeting.title}</h5>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    <button 
                                        onClick={() => setMeetingUrl(meeting.url)}
                                        className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full hover:bg-gray-200"
                                    >
                                        Copy Link
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setMeetingUrl(meeting.url);
                                            setStatus('connecting');
                                            setTimeout(() => setStatus('recording'), 2000);
                                        }}
                                        className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full"
                                    >
                                        Join Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 4. STUDIO VIEW (Image Gen, Edit, Video, Analysis)
const StudioView = () => {
    const [subTab, setSubTab] = useState<'generate'|'edit'|'video'|'analyze'>('generate');
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null); // URL or Text
    const [file, setFile] = useState<File | null>(null);
    
    // Configs
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K"); // Only for Pro
    const [useProImage, setUseProImage] = useState(false);
    const [videoResolution, setVideoResolution] = useState<'720p'|'1080p'>('720p');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
    };

    const executeAction = async () => {
        setLoading(true);
        setResult(null);
        try {
            if (subTab === 'generate') {
                // Generate Image
                if (useProImage) {
                    // Gemini 3 Pro Image (Size, Ratio)
                    const res = await ai.models.generateContent({
                        model: 'gemini-3-pro-image-preview',
                        contents: { parts: [{ text: prompt }] },
                        config: { imageConfig: { aspectRatio, imageSize } } // Supported: 1:1, 3:4, 4:3, 9:16, 16:9 etc.
                    });
                    // Extract image
                    // The SDK example says response.candidates[0].content.parts. find inlineData
                    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                    if (part?.inlineData?.data) {
                        setResult(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                    }
                } else {
                    // Nano Banana (Flash Image)
                    const res = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: { parts: [{ text: prompt }] },
                        config: { imageConfig: { aspectRatio } }
                    });
                    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                    if (part?.inlineData?.data) {
                        setResult(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                    }
                }
            } else if (subTab === 'edit') {
                // Edit Image (Nano Banana)
                if (!file) { alert("Upload an image first"); setLoading(false); return; }
                const base64 = await blobToBase64(file);
                const res = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: file.type, data: base64 } },
                            { text: prompt } // e.g., "Add a retro filter"
                        ]
                    }
                });
                const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (part?.inlineData?.data) {
                    setResult(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                }
            } else if (subTab === 'video') {
                // Veo Video Generation
                // Check key
                if (!(window as any).aistudio?.hasSelectedApiKey()) {
                    await (window as any).aistudio?.openSelectKey();
                    // Re-init AI with new key if needed, but SDK handles process.env.API_KEY injection usually. 
                    // Best practice: create new instance if key changes, but here we assume env var is updated or injected.
                }

                // Create a fresh instance to ensure key usage
                const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                let operation;
                const config = {
                    numberOfVideos: 1,
                    resolution: videoResolution,
                    aspectRatio: (aspectRatio === '16:9' || aspectRatio === '9:16') ? aspectRatio : '16:9' // Veo restriction
                };

                if (file) {
                    // Image-to-Video
                    const base64 = await blobToBase64(file);
                    operation = await veoAi.models.generateVideos({
                        model: 'veo-3.1-fast-generate-preview',
                        prompt: prompt,
                        image: { imageBytes: base64, mimeType: file.type },
                        config
                    });
                } else {
                    // Text-to-Video
                    operation = await veoAi.models.generateVideos({
                        model: 'veo-3.1-fast-generate-preview',
                        prompt: prompt,
                        config
                    });
                }

                // Poll
                while (!operation.done) {
                    await new Promise(r => setTimeout(r, 5000));
                    operation = await veoAi.operations.getVideosOperation({ operation });
                }
                const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (uri) {
                    // Fetch with key
                    const vidRes = await fetch(`${uri}&key=${process.env.API_KEY}`);
                    const blob = await vidRes.blob();
                    const url = URL.createObjectURL(blob);
                    setResult(url);
                }

            } else if (subTab === 'analyze') {
                // Analyze Image or Video (Gemini 3 Pro)
                if (!file) { alert("Upload media first"); setLoading(false); return; }
                const base64 = await blobToBase64(file);
                
                // If video, we typically need to use File API for large files, but for 'analyze' demo we might simulate frame-based or use 'gemini-3-pro-preview' which supports video parts if uploaded via File API (not supported directly in browser simplified example without upload).
                // However, gemini-3-pro-preview accepts video inlineData up to a size limit.
                
                const res = await ai.models.generateContent({
                    model: 'gemini-3-pro-preview',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: file.type, data: base64 } },
                            { text: prompt || "Analyze this media and describe key details." }
                        ]
                    }
                });
                setResult(res.text || "No analysis returned.");
            }

        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit">
                {['generate', 'edit', 'video', 'analyze'].map((t) => (
                    <button key={t} onClick={() => { setSubTab(t as any); setResult(null); setFile(null); }} className={`px-4 py-2 rounded-full text-xs font-bold font-mono uppercase ${subTab === t ? 'bg-black text-white' : 'text-gray-500'}`}>
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Controls */}
                <div className="w-1/3 bg-white border border-gray-100 rounded-[24px] p-6 flex flex-col gap-4">
                    <h3 className="font-mono text-sm uppercase text-gray-400 mb-2">Configuration</h3>
                    
                    {/* File Upload for Edit/Video/Analyze */}
                    {subTab !== 'generate' && (
                        <div>
                            <label className="block text-xs font-bold mb-2">Source Media</label>
                            <input type="file" onChange={handleFileChange} accept={subTab === 'video' ? "image/*" : subTab === 'analyze' ? "image/*,video/*" : "image/*"} className="text-sm" />
                        </div>
                    )}

                    {/* Pro Toggle for Generate */}
                    {subTab === 'generate' && (
                        <div className="flex items-center gap-2">
                             <input type="checkbox" checked={useProImage} onChange={e => setUseProImage(e.target.checked)} />
                             <span className="text-sm font-bold">Use Gemini 3 Pro (High Quality)</span>
                        </div>
                    )}

                    {/* Aspect Ratio */}
                    {(subTab === 'generate' || subTab === 'video') && (
                        <div>
                            <label className="block text-xs font-bold mb-2">Aspect Ratio</label>
                            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-50 border-none rounded-lg p-2 text-sm">
                                <option value="1:1">1:1 (Square)</option>
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                                <option value="4:3">4:3</option>
                                <option value="3:4">3:4</option>
                            </select>
                        </div>
                    )}
                    
                    {/* Size (Pro Image Only) */}
                    {subTab === 'generate' && useProImage && (
                        <div>
                            <label className="block text-xs font-bold mb-2">Size</label>
                            <select value={imageSize} onChange={e => setImageSize(e.target.value)} className="w-full bg-gray-50 border-none rounded-lg p-2 text-sm">
                                <option value="1K">1K</option>
                                <option value="2K">2K</option>
                                <option value="4K">4K</option>
                            </select>
                        </div>
                    )}

                    {/* Prompt */}
                    <div className="flex-1">
                        <label className="block text-xs font-bold mb-2">Prompt</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full h-32 bg-gray-50 border-none rounded-xl p-3 text-sm resize-none" placeholder={subTab === 'edit' ? "e.g., Add a retro filter" : "Describe the output..."} />
                    </div>

                    <button onClick={executeAction} disabled={loading} className="w-full py-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-full font-bold transition-colors">
                        {loading ? "Processing..." : "Execute"}
                    </button>
                    {subTab === 'video' && <p className="text-[10px] text-gray-400 text-center">Requires Paid API Key (Veo)</p>}
                </div>

                {/* Result Area */}
                <div className="flex-1 bg-black rounded-[24px] flex items-center justify-center relative overflow-hidden">
                    {!result && !loading && <span className="text-gray-600 font-mono text-sm">Output Preview</span>}
                    {loading && <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>}
                    {result && subTab === 'video' && <video src={result} controls className="max-w-full max-h-full rounded-lg" />}
                    {result && (subTab === 'generate' || subTab === 'edit') && <img src={result} className="max-w-full max-h-full object-contain" />}
                    {result && subTab === 'analyze' && <div className="p-8 text-white font-mono whitespace-pre-wrap overflow-y-auto max-h-full">{result}</div>}
                </div>
            </div>
        </div>
    );
};

// 5. VOICE VIEW (Live API, TTS, Transcription)
const VoiceView = () => {
    const [status, setStatus] = useState("Ready");
    const [transcript, setTranscript] = useState("");
    const [ttsInput, setTtsInput] = useState("Hello, this is Gemini 2.5 Flash Speech.");
    const [isLiveActive, setIsLiveActive] = useState(false);
    
    // Live API Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // TTS
    const handleTTS = async () => {
        setStatus("Generating Speech...");
        try {
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: { parts: [{ text: ttsInput }] },
                config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
            });
            const base64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64) {
                const ctx = getAudioContext();
                await ctx.resume();
                const arrayBuffer = base64ToArrayBuffer(base64);
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start();
                setStatus("Playing Audio");
            }
        } catch (e: any) {
            setStatus("Error: " + e.message);
        }
    };

    // Transcribe (Microphone)
    const handleTranscribe = async () => {
        setStatus("Listening...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' }); // Chrome uses webm default
                const base64 = await blobToBase64(blob);
                const res = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'audio/webm', data: base64 } },
                            { text: "Transcribe this audio exactly." }
                        ]
                    }
                });
                setTranscript(res.text || "No transcription");
                setStatus("Ready");
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start();
            setTimeout(() => recorder.stop(), 5000); // Record for 5 seconds for demo
        } catch (e) { console.error(e); }
    };

    // LIVE API (Conversational)
    const handleLiveConnect = async () => {
        if (isLiveActive) return; // Disconnect logic not implemented for simplicity in this snippet, just refresh
        setIsLiveActive(true);
        setStatus("Connecting to Live API...");
        
        const ctx = getAudioContext();
        await ctx.resume();
        
        let nextStartTime = 0;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Input Chain
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: { 
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
            },
            callbacks: {
                onopen: () => setStatus("Connected - Speak Now"),
                onmessage: async (msg) => {
                    const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64) {
                        const audioBuffer = await ctx.decodeAudioData(base64ToArrayBuffer(base64));
                        const src = ctx.createBufferSource();
                        src.buffer = audioBuffer;
                        src.connect(ctx.destination);
                        nextStartTime = Math.max(ctx.currentTime, nextStartTime);
                        src.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                    }
                },
                onclose: () => { setStatus("Disconnected"); setIsLiveActive(false); }
            }
        });

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32 to PCM 16
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) pcm16[i] = inputData[i] * 32768;
            
            // Encode to base64
            let binary = '';
            const bytes = new Uint8Array(pcm16.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
            const base64Audio = btoa(binary);

            sessionPromise.then(session => {
                session.sendRealtimeInput({
                    media: { mimeType: 'audio/pcm;rate=24000', data: base64Audio } // SDK example uses different rate matching context? Check ctx sampleRate. Using 24k based on example
                });
            });
        };

        source.connect(processor);
        processor.connect(ctx.destination);
    };

    return (
        <div className="grid grid-cols-2 gap-6 h-full">
            {/* Live Conversation */}
            <div className="bg-black text-white rounded-[24px] p-8 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mb-6 ${isLiveActive ? 'border-[#2563EB] animate-pulse' : 'border-gray-700'}`}>
                    <i className="fa-solid fa-microphone text-3xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-2">Live Conversation</h3>
                <p className="text-gray-400 mb-8 text-sm">Real-time low latency voice chat with Gemini.</p>
                <button onClick={handleLiveConnect} disabled={isLiveActive} className={`px-8 py-3 rounded-full font-bold transition-all ${isLiveActive ? 'bg-gray-800 text-gray-500' : 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white'}`}>
                    {isLiveActive ? "Session Active" : "Start Call"}
                </button>
                <p className="mt-4 font-mono text-xs text-gray-500">{status}</p>
            </div>

            <div className="flex flex-col gap-6">
                {/* TTS */}
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 flex-1">
                    <h3 className="font-mono text-xs uppercase text-gray-400 mb-4">Text to Speech</h3>
                    <textarea value={ttsInput} onChange={e => setTtsInput(e.target.value)} className="w-full h-24 bg-gray-50 border-none rounded-xl p-3 text-sm mb-4 resize-none" />
                    <button onClick={handleTTS} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">Generate Speech</button>
                </div>

                {/* Transcribe */}
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 flex-1">
                    <h3 className="font-mono text-xs uppercase text-gray-400 mb-4">Transcription</h3>
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={handleTranscribe} className="w-12 h-12 bg-red-500 rounded-full text-white flex items-center justify-center hover:bg-red-600 transition-colors">
                            <i className="fa-solid fa-circle"></i>
                        </button>
                        <span className="text-sm font-medium">Record (5s)</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl min-h-[60px] text-sm text-gray-700">
                        {transcript || "Transcription will appear here..."}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'mod+k': () => setCommandPaletteOpen(true),
    'mod+?': () => setShortcutsHelpOpen(true),
    'mod+/': () => setActiveTab('search'),
    'mod+m': () => setActiveTab('meetings'),
  });

  const menuItems = [
    { id: 'home', label: 'Home', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
    { id: 'meetings', label: 'Meetings', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> },
    { id: 'projects', label: 'Projects', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> },
    { id: 'ask-assistant', label: 'Ask Assistant', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> },
    { id: 'automations', label: 'Automations', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> },
    { id: 'agents', label: 'AI Agents', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="m4.93 4.93 2.83 2.83"></path><path d="m16.24 16.24 2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="m4.93 19.07 2.83-2.83"></path><path d="m16.24 7.76 2.83-2.83"></path></svg> },
    { id: 'search', label: 'Search', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> },
    { id: 'inbox', label: 'Action Items', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg> },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
    { id: 'more', label: 'More', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg> }
  ]

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      <nav className="cmf-sidebar">
        <div className="cmf-brand">
            <div className="cmf-brand-icon" style={{ background: 'var(--color-accent)' }}></div>
            <span>Entomate</span>
        </div>
        
        <div className="cmf-nav-list">
          {menuItems.map((item) => (
            <a key={item.id} onClick={() => setActiveTab(item.id)} className={`cmf-menu-item ${activeTab === item.id ? 'active' : ''}`}>
              <div className="cmf-icon flex items-center justify-center">{item.icon}</div>
              <span>{item.label}</span>
            </a>
          ))}
          
          <div className="cmf-divider"></div>
          
           {bottomItems.map((item) => (
            <a key={item.id} onClick={() => item.id === 'settings' && setActiveTab('settings')} className={`cmf-menu-item ${activeTab === item.id ? 'active' : ''}`}>
              <div className="cmf-icon flex items-center justify-center">{item.icon}</div>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
        
        <div className="mt-auto px-6">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer cmf-profile-info">
                <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
                    <svg viewBox="0 0 100 100" fill="#999"><rect width="100" height="100" fill="#e5e5e5"/><circle cx="50" cy="40" r="20" fill="#888"/><circle cx="50" cy="110" r="50" fill="#888"/></svg>
                </div>
                <div className="overflow-hidden">
                    <div className="font-bold text-xs truncate text-gray-900">Design Team</div>
                    <div className="text-[10px] text-gray-500 truncate">Pro Plan</div>
                </div>
            </div>
        </div>
      </nav>
      
      <div className="cmf-main-wrapper">
        <header className="cmf-header">
          <h2 className="cmf-page-title">{menuItems.find(i => i.id === activeTab)?.label || bottomItems.find(i => i.id === activeTab)?.label || 'App'}</h2>
           <div className="flex items-center gap-4">
                {/* Command Palette Search Button */}
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search...</span>
                  <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
                    {getModKey()}K
                  </kbd>
                </button>
                <ThemeToggle compact />
                <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-black dark:hover:text-white transition-colors">
                     <i className="fa-regular fa-bell"></i>
                </button>
           </div>
        </header>
        <main className="cmf-content">
          <ErrorBoundary>
            {activeTab === 'home' && <DashboardHome setActiveTab={setActiveTab} />}
            {activeTab === 'inbox' && <InboxView />}
            {activeTab === 'meetings' && (
              <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Failed to load Meetings. <button onClick={() => window.location.reload()} className="text-blue-600 underline">Reload</button></div>}>
                <MeetingsView />
              </ErrorBoundary>
            )}
            {activeTab === 'projects' && (
              <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Failed to load Projects. <button onClick={() => window.location.reload()} className="text-blue-600 underline">Reload</button></div>}>
                <ProjectsView />
              </ErrorBoundary>
            )}
            {activeTab === 'ask-assistant' && <AskAssistantView />}
            {activeTab === 'automations' && (
              <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Failed to load Automations. <button onClick={() => window.location.reload()} className="text-blue-600 underline">Reload</button></div>}>
                <AutomationsView />
              </ErrorBoundary>
            )}
            {activeTab === 'agents' && (
              <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Failed to load Agents. <button onClick={() => window.location.reload()} className="text-blue-600 underline">Reload</button></div>}>
                <AgentsView />
              </ErrorBoundary>
            )}
            {activeTab === 'search' && (
              <ErrorBoundary fallback={<div className="p-8 text-center text-gray-500">Failed to load Search. <button onClick={() => window.location.reload()} className="text-blue-600 underline">Reload</button></div>}>
                <SearchView />
              </ErrorBoundary>
            )}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'assistant' && <AssistantView />}
            {activeTab === 'studio' && <StudioView />}
            {activeTab === 'voice' && <VoiceView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(tabId) => setActiveTab(tabId)}
        onShowShortcuts={() => {
          setCommandPaletteOpen(false);
          setShortcutsHelpOpen(true);
        }}
      />

      {/* Keyboard Shortcuts Help (Cmd+?) */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);