import React, { useState, useEffect } from 'react';
import LearnQuestLanding from './LearnQuestLanding.jsx';
import StudentDashboard from './components/StudentDashBoard.jsx';
import SubjectStudyPage from './components/SubjectStudyPage.jsx';
import QuizSection from './components/QuizSection.jsx';
import LeaderboardPage from './components/LeaderboardPage.jsx';
import GuardianDashboard from './components/GuardianDashboard.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import { api } from './utils/api.js';

function App() {
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [studentStats, setStudentStats] = useState({
    name: 'Aarav',
    points: 120,
    rupees: 12,
    streak: 3,
    level: 2,
    unlockedLevel: 2,
    weakAreas: ['Fractions'],
    strongAreas: ['Addition & Subtraction'],
  });

  const [childrenList, setChildrenList] = useState([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedKid, setSelectedKid] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Check child profile on mount
  useEffect(() => {
    api('/learn/profile')
      .then((data) => {
        if (data.child) {
          setStudentStats((prev) => ({
            ...prev,
            name: data.child.name,
            points: data.child.points,
            rupees: Math.floor(data.child.points / 10),
            streak: data.child.streakDays || 1,
            level: data.child.level || 1,
          }));
        }
      })
      .catch(() => {});

    api('/children')
      .then((res) => {
        setChildrenList(res.children || []);
      })
      .catch(() => {});
  }, [currentScreen]);

  const handleUnlockChild = async (e) => {
    e.preventDefault();
    setPinError('');
    try {
      const res = await api('/auth/child-login', {
        method: 'POST',
        body: {
          childId: selectedKid.id,
          pin: pinInput,
        },
      });
      setStudentStats((prev) => ({
        ...prev,
        name: res.child.name,
        points: res.child.points || 0,
        rupees: Math.floor((res.child.points || 0) / 10),
        level: res.child.level || 1,
        streak: res.child.streakDays || 0,
      }));
      setShowPinModal(false);
      setPinInput('');
      setCurrentScreen('dashboard');
    } catch (err) {
      setPinError(err.message);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return (
          <LearnQuestLanding
            onLoginSuccess={(name) => {
              setStudentStats((p) => ({ ...p, name }));
              setCurrentScreen('dashboard');
            }}
            onOpenGuardian={() => setCurrentScreen('guardian')}
            onOpenAdmin={() => setCurrentScreen('admin')}
            onSelectKidForPin={() => setShowPinModal(true)}
          />
        );
      case 'dashboard':
        return (
          <StudentDashboard
            studentStats={studentStats}
            setScreen={setCurrentScreen}
          />
        );
      case 'subjects':
        return (
          <SubjectStudyPage
            studentStats={studentStats}
            setScreen={setCurrentScreen}
          />
        );
      case 'quiz':
        return (
          <QuizSection
            studentStats={studentStats}
            setStudentStats={setStudentStats}
            setScreen={setCurrentScreen}
          />
        );
      case 'leaderboard':
        return (
          <LeaderboardPage
            studentStats={studentStats}
            setScreen={setCurrentScreen}
          />
        );
      case 'guardian':
        return (
          <GuardianDashboard
            onBackToGame={() => setCurrentScreen('landing')}
          />
        );
      case 'admin':
        return (
          <AdminDashboard
            onBackToGame={() => setCurrentScreen('landing')}
          />
        );
      default:
        return (
          <LearnQuestLanding
            onLoginSuccess={() => setCurrentScreen('dashboard')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-[#1E2229] font-sans pb-16 relative">
      {/* Active Screen Rendering */}
      {renderScreen()}

      {/* 4-DIGIT PIN UNLOCK MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-up text-center">
            <span className="text-5xl block mb-3 animate-bounce">🎮</span>
            <h3 className="text-xl font-black text-cosmicText mb-1">Pick Your Learner</h3>
            <p className="text-xs text-gray-400 font-bold mb-6">
              Enter 4-digit PIN (5 wrong attempts will lock for 10 minutes)
            </p>

            {childrenList.length > 0 && !selectedKid && (
              <div className="space-y-2 mb-4">
                {childrenList.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setSelectedKid(k)}
                    className="w-full p-3 rounded-2xl border-2 border-gray-200 hover:border-electricBlue text-left font-black text-sm flex justify-between items-center"
                  >
                    <span>👶 {k.name}</span>
                    <span className="text-xs text-gray-400">Class {k.grade}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedKid && (
              <form onSubmit={handleUnlockChild} className="space-y-4">
                <div className="p-2 bg-blue-50 text-electricBlue font-black text-xs rounded-xl">
                  Player: {selectedKid.name} (Class {selectedKid.grade})
                </div>

                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  autoFocus
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center text-3xl font-black tracking-widest py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-electricBlue"
                />

                {pinError && (
                  <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-xl">
                    {pinError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedKid(null); setPinInput(''); setPinError(''); }}
                    className="flex-1 py-3 bg-gray-100 font-black text-xs rounded-xl text-gray-600"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-electricBlue text-white font-black text-xs rounded-xl shadow-electric-glow"
                  >
                    Unlock & Play →
                  </button>
                </div>
              </form>
            )}

            {!selectedKid && (
              <button
                onClick={() => setShowPinModal(false)}
                className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🚀 BOTTOM NAVIGATION & ROLE SWITCHER */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 z-40 flex justify-between items-center px-4 max-w-5xl mx-auto rounded-t-3xl shadow-lg">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">🎮 Mission Hub:</span>
          {[
            { id: 'landing', label: 'Home' },
            { id: 'dashboard', label: 'Star Map' },
            { id: 'subjects', label: 'Subjects' },
            { id: 'quiz', label: 'Play Quiz' },
            { id: 'leaderboard', label: 'Leaderboard' },
          ].map((screen) => (
            <button
              key={screen.id}
              onClick={() => setCurrentScreen(screen.id)}
              className={`text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition-all ${
                currentScreen === screen.id
                  ? 'bg-electricBlue text-white border-electricBlue shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {screen.label}
            </button>
          ))}
        </div>

        {/* Portal Shortcuts: Guardian & Admin */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentScreen('guardian')}
            className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all ${
              currentScreen === 'guardian'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
            }`}
          >
            🛡️ Parent Portal
          </button>
          <button
            onClick={() => setCurrentScreen('admin')}
            className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all ${
              currentScreen === 'admin'
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            ⚙️ Admin
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
