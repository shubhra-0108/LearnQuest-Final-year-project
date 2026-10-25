import React from 'react';

export default function TopBar({ stats }) {
  if (!stats) return null;
  
  return (
    <div className="w-full bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm">
      {/* Profile & Streak Row */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#3A86FF] text-white rounded-xl flex items-center justify-center font-black text-base border border-blue-400">
            {stats.name ? stats.name[0].toUpperCase() : 'E'}
          </div>
          <span className="font-black text-sm text-[#1E2229]">Hi, {stats.name}!</span>
        </div>
        
        {/* Active Days Streak */}
        <div className="bg-[#FF9F1C]/10 border border-[#FF9F1C]/30 px-3 py-1 rounded-lg flex items-center gap-1">
          <span className="text-xs">🔥</span>
          <span className="font-black text-[11px] text-[#FF9F1C]">{stats.streak} Days Streak</span>
        </div>
      </div>

      <hr className="border-gray-100 mb-3" />

      {/* Score & Badges Row */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Score Tracking</p>
          <p className="text-xl font-black text-[#3A86FF] flex items-center gap-1">
            ⭐ <span>{stats.points}</span> <span className="text-[10px] text-gray-400 font-bold">XP</span>
          </p>
        </div>

        {/* Level Indicator Badge */}
        <div className="bg-[#2EC4B6]/10 border border-[#2EC4B6]/30 px-2.5 py-1 rounded-lg text-right">
          <span className="text-[10px] font-black text-gray-400 block uppercase">Rank Level</span>
          <span className="font-black text-xs text-[#2EC4B6]">Lvl {stats.level || 1} Explorer</span>
        </div>
      </div>
    </div>
  );
}