import React from 'react';
import { BarChart3, Calendar, Layers, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { NavTab } from './Sidebar';
import { UserRole } from '../types';

interface QuickTabNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentRole: UserRole;
}

export const QuickTabNav: React.FC<QuickTabNavProps> = ({
  activeTab,
  onTabChange,
  currentRole
}) => {
  const canAddEntry = currentRole === 'Admin' || currentRole === 'Site Engineer';

  const items = [
    { id: 'overview' as NavTab, label: 'Ringkasan', icon: BarChart3 },
    { id: 'bulan' as NavTab, label: 'Bulan', icon: Calendar },
    { id: 'jenis' as NavTab, label: 'Krosok', icon: Layers },
    { id: 'data_log' as NavTab, label: 'Log Data', icon: FileSpreadsheet },
    ...(canAddEntry ? [{ id: 'new_entry' as NavTab, label: 'Entri', icon: PlusCircle }] : [])
  ];

  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 md:hidden shadow-lg">
      <div className="flex items-center justify-around gap-1 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-blue-600 font-bold bg-blue-50/80 scale-105'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
