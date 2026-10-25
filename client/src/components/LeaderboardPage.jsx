import React from 'react';

export default function LeaderboardPage({ studentStats, setScreen }) {
  const rankingList = [
    { rank: 1, name: "Aryan Sharma", xp: "2450 XP", badge: "👑" },
    { rank: 2, name: "Priya Verma", xp: "2300 XP", badge: "⚡" },
    { rank: 3, name: "Rohan Mehta", xp: "2100 XP", badge: "🔥" },
    { rank: 4, name: `${studentStats.name} (You)`, xp: `${studentStats.points} XP`, badge: "🚀", active: true }
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setScreen('dashboard')} className="text-sm font-black text-gray-500 hover:text-cosmicText">
          ← Back to Map
        </button>
        <span className="text-xs font-black uppercase bg-gray-100 px-3 py-1 rounded-full text-gray-500">
          Rank Board
        </span>
      </div>

      <h2 className="text-2xl font-black text-cosmicText mb-1">Global Top Explorers</h2>
      <p className="text-xs text-gray-400 font-bold mb-6">Weekly top performers across the platform.</p>

      {/* LEADERBOARD LIST ROWS */}
      <div className="flex flex-col gap-3">
        {rankingList.map((user) => (
          <div
            key={user.rank}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all
              ${user.active 
                ? 'bg-blue-50/50 border-electricBlue shadow-sm' 
                : 'bg-white border-gray-200'
              }`}
          >
            <div className="flex items-center gap-4">
              <span className={`w-6 font-black text-sm text-center ${user.rank === 1 ? 'text-solarAmber' : 'text-gray-400'}`}>
                #{user.rank}
              </span>
              <span className="text-lg">{user.badge}</span>
              <span className="font-black text-sm text-cosmicText">{user.name}</span>
            </div>
            <span className="font-black text-sm text-electricBlue">{user.xp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}