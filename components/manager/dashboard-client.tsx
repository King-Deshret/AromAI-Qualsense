'use client';
import { useState } from 'react';
import { ManagerMonitorPanel } from './monitor-panel';
import { ManagerDecisionPanel } from './decision-panel';
import type { Lot } from '@/lib/types';

export function ManagerDashboardClient() {
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-1/2 border-r border-gray-200 flex flex-col overflow-hidden">
        <ManagerMonitorPanel onSelectLot={setSelectedLot} />
      </div>
      <div className="w-1/2 flex flex-col overflow-hidden">
        <ManagerDecisionPanel selectedLot={selectedLot} />
      </div>
    </div>
  );
}
