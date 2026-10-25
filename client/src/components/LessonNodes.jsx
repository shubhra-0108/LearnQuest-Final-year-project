import React from 'react';

const MAP_LEVELS = [
  { id: 1, title: "Alphabet Island", icon: "🅰️", color: "bg-gradient-to-r from-red-400 to-orange-400" },
  { id: 2, title: "Counting Castle", icon: "🔢", color: "bg-gradient-to-r from-[#FF9F1C] to-amber-500" },
  { id: 3, title: "Word Jungle", icon: "🦁", color: "bg-gradient-to-r from-[#2EC4B6] to-teal-600" },
  { id: 4, title: "Story Mountain", icon: "🏔️", color: "bg-gradient-to-r from-[#3A86FF] to-indigo-600" },
];

export default function LessonNodes({ unlockedLevel, onNodeSelect }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 relative w-full bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
      
      {MAP_LEVELS.map((level) => {
        const isUnlocked = level.id <= unlockedLevel;
        
        return (
          <div key={level.id} className="w-full">
            <button
              onClick={() => onNodeSelect(level.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all duration-150 text-left active:translate-y-0.5
                ${isUnlocked 
                  ? 'bg-gray-50 border-gray-200 hover:bg-gray-100/80 shadow-sm' 
                  : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                }
              `}
            >
              {/* Floating Node Icon Badge */}
              <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center text-xl shrink-0 shadow-sm font-black
                ${isUnlocked ? level.color : 'bg-gray-400'}`}>
                {isUnlocked ? level.icon : "🔒"}
              </div>

              {/* Information Text */}
              <div className="overflow-hidden">
                <span className="block text-[10px] uppercase font-black tracking-widest text-gray-400">
                  Mission 0{level.id}
                </span>
                <span className="block font-black text-sm text-[#1E2229] truncate">
                  {level.title}
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}