import React from 'react';

export default function SubjectStudyPage({ studentStats, setScreen }) {
  const subjects = [
    { id: 'math', title: 'Mathematics', icon: '📐', count: '12 Quizzes Available', color: 'border-l-electricBlue' },
    { id: 'science', title: 'Science & Biology', icon: '🔬', count: '8 Missions Active', color: 'border-l-auroraMint' },
    { id: 'history', title: 'World History', icon: '🏛️', count: '5 Stories Open', color: 'border-l-solarAmber' },
    { id: 'reasoning', title: 'Logical Reasoning', icon: '🧩', count: '15 Mind Puzzles', color: 'border-l-indigo-500' }
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      {/* Back button header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setScreen('dashboard')} className="text-sm font-black text-gray-500 hover:text-cosmicText">
          ← Back to Map
        </button>
        <span className="text-xs font-black uppercase bg-gray-100 px-3 py-1 rounded-full text-gray-500">
          Choose Subject
        </span>
      </div>

      <h2 className="text-2xl font-black text-cosmicText mb-2">Explore Subject Hubs</h2>
      <p className="text-xs text-gray-400 font-bold mb-6">Select a cosmic discipline to accelerate your scores.</p>

      {/* GRID LAYOUT */}
      <div className="flex flex-col gap-4">
        {subjects.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setScreen('quiz')}
            className={`w-full bg-white border border-gray-200/80 border-l-4 ${sub.color} p-4 rounded-2xl text-left shadow-sm hover:shadow-md active:translate-y-0.5 transition-all flex items-center justify-between`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl border border-gray-100 shadow-sm">
                {sub.icon}
              </div>
              <div>
                <h4 className="font-black text-base text-cosmicText">{sub.title}</h4>
                <p className="text-xs text-gray-400 font-bold">{sub.count}</p>
              </div>
            </div>
            <span className="text-xl text-gray-300">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}