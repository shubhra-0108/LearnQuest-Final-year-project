import React from 'react';
import TopBar from './TopBar';
import LessonNodes from './LessonNodes';

export default function StudentDashboard({ studentStats, setScreen }) {
  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-24 relative">
      <TopBar stats={studentStats} />

      {/* AI SUGGESTIONS CONTEXT BAR */}
      <div className="mt-4 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm bg-gradient-to-r from-blue-50/40 to-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔮</span>
          <h3 className="font-black text-xs uppercase tracking-wider text-electricBlue">AI Guidance Track</h3>
        </div>
        <p className="text-xs font-bold text-gray-600 leading-relaxed">
          Hi {studentStats.name}! Aapka {studentStats.strongAreas[0]} strong hai! Par hume {studentStats.weakAreas[0]} improve karna hai. Chalo Quiz Zone ya Subject grid start karein!
        </p>
      </div>

      {/* CORE NAVIGATION BAR LINKS */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <button onClick={() => setScreen('subjects')} className="p-3 bg-white border border-gray-200 font-black text-xs rounded-xl shadow-sm text-center hover:bg-gray-50 active:translate-y-0.5 transition-all">
          📚 Subjects
        </button>
        <button onClick={() => setScreen('quiz')} className="p-3 bg-gradient-to-r from-electricBlue to-indigo-500 text-white font-black text-xs rounded-xl shadow-md text-center active:translate-y-0.5 transition-all">
          🎮 Quiz Zone
        </button>
        <button onClick={() => setScreen('leaderboard')} className="p-3 bg-white border border-gray-200 font-black text-xs rounded-xl shadow-sm text-center hover:bg-gray-50 active:translate-y-0.5 transition-all">
          🏆 Leaderboard
        </button>
      </div>

      {/* INTERACTIVE MAP MAP */}
      <div className="mt-6 text-center">
        <h2 className="text-lg font-black text-cosmicText tracking-wide uppercase mb-1">🗺️ Star Chart Map</h2>
        <p className="text-xs text-gray-400 font-bold mb-4">Tap on nodes to start your mission modules!</p>
        <LessonNodes unlockedLevel={studentStats.unlockedLevel} onNodeSelect={(id) => setScreen('quiz')} />
      </div>
    </div>
  );
}