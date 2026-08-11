import { useState } from 'react';
import { MessageSquare, Zap, Send } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { LiveChatSession, LiveChatMessage, SupportAgent } from '../../types/support';

interface Props {
  agents: SupportAgent[];
  onConvertChatToTicket: (session: LiveChatSession) => void;
}

const INITIAL_LIVE_SESSIONS: LiveChatSession[] = [
  {
    id: 'chat-sess-101',
    customer_name: 'طارق بوخميس (Tarek Boukhemis)',
    customer_phone: '0555998877',
    customer_type: 'wholesale',
    status: 'active',
    started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    last_message: 'أريد الاستفسار عن كوتاسيون جملة للأجهزة الكهرومنزلية',
    unread_count: 1,
    assigned_agent_id: 'ag-1',
    messages: [
      {
        id: 'msg-1',
        session_id: 'chat-sess-101',
        sender: 'customer',
        sender_name: 'طارق بوخميس',
        text: 'السلام عليكم، أنا صيدلي وموزع من سطيف، أبحث عن كوتاسيون بالجملة',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        session_id: 'chat-sess-101',
        sender: 'agent',
        sender_name: 'زكريا (الدعم الفني)',
        text: 'وعليكم السلام ورحمة الله أستاذ طارق! مرحباً بك، يسعدنا تزويدك بقائمة الأسعار والتخفيضات المتاحة للطلبيات الكبيرة.',
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-3',
        session_id: 'chat-sess-101',
        sender: 'customer',
        sender_name: 'طارق بوخميس',
        text: 'أريد الاستفسار عن كوتاسيون جملة للأجهزة الكهرومنزلية وحجم الكميات الأدنى (MOQ)',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      }
    ]
  },
  {
    id: 'chat-sess-102',
    customer_name: 'أمينة بن يوسف',
    customer_phone: '0770112233',
    customer_type: 'retail',
    status: 'active',
    started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    last_message: 'هل التوصيل متوفر لولاية تمنراست؟',
    unread_count: 0,
    assigned_agent_id: 'ag-2',
    messages: [
      {
        id: 'msg-10',
        session_id: 'chat-sess-102',
        sender: 'customer',
        sender_name: 'أمينة بن يوسف',
        text: 'مرحباً، هل التوصيل متوفر لولاية تمنراست وكم يستغرق من الوقت؟',
        timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-11',
        session_id: 'chat-sess-102',
        sender: 'agent',
        sender_name: 'ياسين (الدعم)',
        text: 'أهلاً بك سيدتي! نعم التوصيل متوفر لولاية تمنراست للمكتب والمنزل خلال 4 إلى 6 أيام عمل.',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      }
    ]
  }
];

export default function SupportLiveChatView({
  onConvertChatToTicket,
}: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [sessions, setSessions] = useState<LiveChatSession[]>(INITIAL_LIVE_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_LIVE_SESSIONS[0].id);
  const [chatInput, setChatInput] = useState('');
  const [agentStatus, setAgentStatus] = useState<'online' | 'away' | 'offline'>('online');
  const [isTypingSimulated, setIsTypingSimulated] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Send Live Message Handler
  const handleSendMessage = () => {
    if (!chatInput.trim() || !activeSession) return;

    const newMsg: LiveChatMessage = {
      id: `chat-msg-${Date.now()}`,
      session_id: activeSession.id,
      sender: 'agent',
      sender_name: 'الدعم الفني المباشر',
      text: chatInput,
      timestamp: new Date().toISOString(),
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          last_message: chatInput,
          messages: [...s.messages, newMsg],
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    setChatInput('');

    // Simulate customer typing back after 3 seconds
    setIsTypingSimulated(true);
    setTimeout(() => {
      setIsTypingSimulated(false);
    }, 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <span>{tr('منصة المحادثات الحية والمباشرة (Live Support Engine)', 'Plateforme Chat En Direct')}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-xs text-slate-400">
              {tr('الرد الفوري على الزوار والعملاء مع إمكانية تحويل المحادثة لتذكرة رسمية', 'Réponse instantanée & conversion en ticket')}
            </p>
          </div>
        </div>

        {/* Agent Online Status Toggle */}
        <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-slate-400">{tr('حالتك الآن:', 'Votre Statut:')}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAgentStatus('online')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                agentStatus === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              <span>{tr('متصل', 'En ligne')}</span>
            </button>

            <button
              onClick={() => setAgentStatus('away')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                agentStatus === 'away' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-300" />
              <span>{tr('مشغول', 'Occupé')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Live Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[550px]">
        {/* Left List of Active Chat Sessions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col space-y-2 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-2 text-xs font-bold text-slate-300">
            <span>{tr('المحادثات النشطة', 'Sessions Actives')} ({sessions.length})</span>
            <span className="text-[10px] text-emerald-400 font-mono">Live Sync</span>
          </div>

          <div className="space-y-1.5 flex-1">
            {sessions.map(s => {
              const isActive = s.id === activeSession.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`w-full text-start p-3 rounded-xl border transition flex flex-col space-y-1 ${
                    isActive
                      ? 'bg-slate-800 border-emerald-500 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-xs flex items-center gap-1">
                      <span>{s.customer_name}</span>
                      {s.customer_type === 'wholesale' && (
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded">B2B</span>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">{s.customer_phone}</p>
                  <p className="text-[11px] text-slate-300 truncate">{s.last_message}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Live Conversation Area */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                {activeSession.customer_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-100 text-xs flex items-center gap-2">
                  <span>{activeSession.customer_name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{activeSession.customer_phone}</span>
                </p>
                {isTypingSimulated && (
                  <p className="text-[10px] text-emerald-400 font-bold animate-pulse">
                    {tr('العميل يكتب الآن...', 'Le client écrit...')}
                  </p>
                )}
              </div>
            </div>

            {/* Convert Chat to Ticket Button */}
            <button
              onClick={() => onConvertChatToTicket(activeSession)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{tr('تحويل إلى تذكرة دعم', 'Convertir en ticket')}</span>
            </button>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
            {activeSession.messages.map(msg => {
              const isAgent = msg.sender === 'agent';
              return (
                <div key={msg.id} className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-0.5">{msg.sender_name}</span>
                  <div className={`p-3 rounded-2xl max-w-[80%] text-xs ${
                    isAgent ? 'bg-emerald-600 text-white rounded-te-none' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-ts-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Message Input Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={tr('اكتب ردك المباشر للعميل...', 'Tapez votre message en direct...')}
              className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
            />

            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
