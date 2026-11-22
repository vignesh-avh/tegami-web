"use client";

const CATEGORIES = [
  { 
    name: "All", 
    icon: "M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z"
  },
  { 
    name: "Kirana", 
    icon: "M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"
  },
  { 
    name: "Snacks", 
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"
  },
  { 
    name: "Dairy", 
    icon: "M12 2c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"
  },
  { 
    name: "Drinks", 
    icon: "M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"
  },
  { 
    name: "Fruits & vegetables", 
    icon: "M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"
  },
  { 
    name: "TechTools", 
    icon: "M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"
  },
  { 
    name: "Stat.", 
    icon: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
  },
  { 
    name: "Others", 
    icon: "M12 2l-5.5 9h11z M17.5 17.5m-4.5 0a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0 -9 0 M3 13.5h8v8H3z"
  },
];

export default function CategoryScrollRow({ 
  selected, 
  onSelect 
}: { 
  selected: string, 
  onSelect: (category: string) => void 
}) {
  return (
    <div className="px-4 py-[2px] overflow-x-auto no-scrollbar flex gap-[6px]">
      {CATEGORIES.map((cat) => {
        const isActive = cat.name === selected;
        return (
          <button 
            key={cat.name} 
            onClick={() => onSelect(cat.name)}
            className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap border transition-all active:scale-95 ${
              isActive 
                ? 'bg-[#6200EE]/80 text-white border-transparent' 
                : 'bg-[#F5F5F5] text-[#424242] border-[#E5E7EB]'
            }`}
          >
            <svg className={`w-[14px] h-[14px] ${isActive ? 'text-white' : 'text-[#424242]'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d={cat.icon} />
            </svg>
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}