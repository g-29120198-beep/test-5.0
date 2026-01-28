
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserPlus as UserPlusIcon, 
  BarChart3 as BarChartIcon, 
  FileText as FileTextIcon, 
  Database as DatabaseIcon, 
  RefreshCw as RefreshIcon, 
  AlertCircle as AlertIcon, 
  CheckCircle2 as CheckIcon, 
  Sparkles as SparkleIcon,
  Timer as TimerIcon
} from 'lucide-react';
import Header from './components/Header';
import ProgressForm from './components/ProgressForm';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import DataManagement from './components/DataManagement';
import { ReadingRecord, Student, CloudConfig, ClassOption } from './types';
import { MOCK_STUDENTS } from './constants';

type Tab = 'input' | 'dashboard' | 'reports' | 'quran_perkasa' | 'data';

const SCHOOL_LOGO_URL = "https://iili.io/f6tjSUB.jpg";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  useEffect(() => {
    // Loader handling
    const loader = document.getElementById('serqi-loader');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
          loader.style.visibility = 'hidden';
        }, 500);
      }, 300);
    }

    // Standalone Detection
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // PWA Install Prompt handling
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('SERQI telah berjaya dipasang!');
    });
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => {
    try {
      const saved = localStorage.getItem('serqi_cloud_config');
      const config = saved ? JSON.parse(saved) : { isEnabled: false, projectUrl: '', apiKey: '', lastSync: null };
      const params = new URLSearchParams(window.location.search);
      const shortSync = params.get('s');
      if (shortSync) {
        try {
          const decodedUrl = atob(shortSync);
          return { ...config, isEnabled: true, projectUrl: decodedUrl };
        } catch(e) { console.error("Kod Sync rosak"); }
      }
      return config;
    } catch (e) {
      return { isEnabled: false, projectUrl: '', apiKey: '', lastSync: null };
    }
  });

  const [records, setRecords] = useState<ReadingRecord[]>(() => {
    try {
      const saved = localStorage.getItem('tilawah_records');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('serqi_students');
      return saved ? JSON.parse(saved) : MOCK_STUDENTS;
    } catch (e) { return MOCK_STUDENTS; }
  });

  const recordsRef = useRef(records);
  const studentsRef = useRef(students);
  useEffect(() => { recordsRef.current = records; }, [records]);
  useEffect(() => { studentsRef.current = students; }, [students]);

  const syncWithCloud = async (forcePull = false, isSilent = false, overrideRecords?: ReadingRecord[], overrideStudents?: Student[]) => {
    if (!cloudConfig.projectUrl) {
       if (!isSilent) alert("Sila masukkan URL Cloud (/exec) di tab Setting dahulu.");
       return;
    }
    
    if (!isSilent) setIsSyncing(true);

    try {
      if (forcePull) {
        const response = await fetch(`${cloudConfig.projectUrl}${cloudConfig.projectUrl.includes('?') ? '&' : '?'}action=fetch&t=${Date.now()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error("Gagal menghubungi server Google.");
        
        const data = await response.json();
        if (data.students && Array.isArray(data.students)) {
          setStudents(data.students);
          if (data.records) setRecords(data.records);
          if (!isSilent) setSyncStatus({ 
            type: 'success', 
            message: `BERJAYA! ${data.students.length} MURID & ${data.records?.length || 0} REKOD DITARIK.` 
          });
        } else {
          throw new Error("Data murid tidak dijumpai dalam Spreadsheet.");
        }
      } else {
        const currentStudents = overrideStudents || studentsRef.current;
        const currentRecords = overrideRecords || recordsRef.current;
        const dataToPush = { students: currentStudents, records: currentRecords };
        
        await fetch(cloudConfig.projectUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(dataToPush)
        });
        
        if (!isSilent) setSyncStatus({ type: 'success', message: "DATA BERJAYA DIHANTAR KE CLOUD." });
      }
      setCloudConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
    } catch (err: any) {
      console.error("Sync Error:", err);
      if (!isSilent) setSyncStatus({ type: 'error', message: err.message || "Sambungan Cloud gagal." });
    } finally {
      if (!isSilent) setIsSyncing(false);
      if (!isSilent) setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleSaveRecord = async (newRecord: ReadingRecord) => {
    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    if (cloudConfig.isEnabled && cloudConfig.projectUrl) {
      syncWithCloud(false, true, updatedRecords);
    }
  };

  const availableClasses = useMemo(() => {
    const classMap = new Map<string, ClassOption>();
    students.forEach(s => {
      if (s && s.className) {
        if (!classMap.has(s.className)) {
          classMap.set(s.className, { id: s.className.replace(/\s+/g, '-'), name: s.className, grade: s.grade });
        }
      }
    });
    return Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('tilawah_records', JSON.stringify(records));
    localStorage.setItem('serqi_students', JSON.stringify(students));
    localStorage.setItem('serqi_cloud_config', JSON.stringify(cloudConfig));
  }, [records, students, cloudConfig]);

  const menuItems = [
    { id: 'input', icon: null, label: 'Input', color: 'emerald' },
    { id: 'dashboard', icon: BarChartIcon, label: 'Analisis', color: 'indigo' },
    { id: 'reports', icon: FileTextIcon, label: 'Slip', color: 'sky' },
    { id: 'quran_perkasa', icon: SparkleIcon, label: 'Perkasa', color: 'amber' },
    { id: 'data', icon: DatabaseIcon, label: 'Setting', color: 'slate' }
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8fafc] overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white p-8">
        <div className="mb-14 text-center px-4">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 p-2 shadow-xl flex items-center justify-center">
            <img src={SCHOOL_LOGO_URL} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <p className="text-[11px] font-black text-slate-100 uppercase tracking-[0.15em] leading-relaxed">
            SK BUKIT RAMBAI
          </p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 opacity-70">
            -SERQI SISTEM-
          </p>
          <div className="h-[1px] w-12 bg-slate-800 mx-auto mt-4" />
        </div>
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id as Tab)} 
              className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all ${activeTab === item.id ? `bg-${item.color}-600 text-white shadow-xl` : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {item.id === 'input' ? (
                <img src={SCHOOL_LOGO_URL} alt="Input" className={`w-5 h-5 object-contain ${activeTab === 'input' ? '' : 'opacity-40 grayscale'}`} />
              ) : (
                item.icon && <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500'}`} />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Header activeTab={activeTab} isCloudEnabled={cloudConfig.isEnabled} isSyncing={isSyncing} logoUrl={SCHOOL_LOGO_URL} />
        
        {syncStatus && (
          <div className={`fixed top-24 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 border-2 ${
            syncStatus.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 
            syncStatus.type === 'error' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'bg-sky-50 border-sky-500 text-sky-800'
          }`}>
            {syncStatus.type === 'success' ? <CheckIcon className="w-5 h-5" /> : <AlertIcon className="w-5 h-5" />}
            <span className="text-xs font-black uppercase tracking-wider">{syncStatus.message}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-10 py-6">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'input' && (
              <ProgressForm 
                onSave={handleSaveRecord} 
                getLatestRecord={(id) => records.find(r => r.studentId === id)} 
                students={students} 
                allRecords={records} 
                availableClasses={availableClasses} 
                logoUrl={SCHOOL_LOGO_URL} 
                onUpdateStudents={setStudents}
              />
            )}
            {activeTab === 'dashboard' && <Dashboard records={records} students={students} />}
            {activeTab === 'reports' && <Reports records={records} students={students} availableClasses={availableClasses} logoUrl={SCHOOL_LOGO_URL} />}
            {activeTab === 'quran_perkasa' && (
              <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden max-w-2xl w-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full" />
                  <div className="relative mx-auto w-24 h-24 bg-amber-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-amber-200 rotate-6">
                     <TimerIcon className="text-white w-12 h-12" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sistem Belum Aktif</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      Modul Murid Perkasa Al-Quran sedang dalam proses pembangunan.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'data' && (
              <DataManagement 
                students={students} records={records} cloudConfig={cloudConfig} 
                onUpdateStudents={setStudents} onUpdateRecords={setRecords} 
                onUpdateCloudConfig={setCloudConfig} onSyncPull={() => syncWithCloud(true)} 
                onSyncPush={() => syncWithCloud(false)} availableClasses={availableClasses} 
                isSyncing={isSyncing} onDeleteStudent={(id) => setStudents(prev => prev.filter(s => s.id !== id))} 
                onAddStudent={(s) => setStudents(prev => [...prev, s])} 
                canInstall={!!deferredPrompt}
                onInstall={handleInstallApp}
                isStandalone={isStandalone}
              />
            )}
          </div>
        </div>

        <nav className="md:hidden flex items-center justify-around bg-slate-900 text-white py-4 px-2 border-t border-white/5 pb-8">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`flex flex-col items-center gap-2 ${activeTab === item.id ? 'text-white' : 'text-slate-500'}`}>
              <div className={`p-2.5 rounded-xl transition-all ${activeTab === item.id ? `bg-${item.color}-600 shadow-lg scale-110` : ''}`}>
                {item.id === 'input' ? (
                  <img src={SCHOOL_LOGO_URL} alt="Input" className={`w-5 h-5 object-contain ${activeTab === 'input' ? '' : 'opacity-40 grayscale'}`} />
                ) : (
                  item.icon && <item.icon className="w-5 h-5" />
                )}
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em]">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default App;
