'use client';

import React from 'react';
import { HarvestLog, Tree } from '@/lib/db'; // Removed PlantingLog, SeedBatch, Crop as direct props
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

// Define the structure of the enriched harvest log item
interface EnrichedHarvestLog extends HarvestLog {
  plantingLogDetails?: any; // Or a more specific type if defined for enriched planting log info
  treeDetails?: Tree;
  sourceDisplay: string;
  varietyDisplay: string;
}

interface HarvestLogListProps {
  harvestLogs: EnrichedHarvestLog[]; // Expect enriched logs
  // plantingLogs: PlantingLog[]; // Removed
  // seedBatches: SeedBatch[]; // Removed
  // crops: Crop[]; // Removed
  onEdit: (log: HarvestLog) => void; // Still pass original HarvestLog type for editing
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function HarvestLogList({
  harvestLogs,
  // plantingLogs, // Removed
  // seedBatches, // Removed
  // crops, // Removed
  onEdit,
  onDelete,
  isDeleting
}: HarvestLogListProps) {

  // const getPlantingLogInfo = (plantingLogId: string) => { ... }; // Removed

  const activeHarvestLogs = harvestLogs.filter(log => log.is_deleted !== 1);

  if (activeHarvestLogs.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No active harvest logs found. Record your first harvest!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Harvest Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Source (Crop/Tree - Variety)</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Qty Harvested</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Quality Grade</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeHarvestLogs.map((log) => (
            <tr key={log.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{formatDateToDDMMYYYY(log.harvest_date)}</td>
              <td className="py-3 px-5">
                {log.sourceDisplay}
                {log.varietyDisplay && <span className="text-xs text-gray-500 ml-1">({log.varietyDisplay})</span>}
              </td>
              <td className="py-3 px-5 text-right">{log.quantity_harvested}</td>
              <td className="py-3 px-5">{log.quantity_unit}</td>
              <td className="py-3 px-5">{log.quality_grade || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-center">
                {log._synced === 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : log._synced === 1 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Synced
                  </span>
                ) : (
                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Unknown
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-center">
                <button
                  onClick={() => onEdit(log)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isDeleting === log.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(log.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === log.id}
                >
                  {isDeleting === log.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}