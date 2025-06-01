'use client';

import React from 'react';
import { PlantingLog, SeedBatch, Crop, InputInventory, PurchasedSeedling, SeedlingProductionLog } from '@/lib/db'; // Added PurchasedSeedling and SeedlingProductionLog
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface PlantingLogListProps {
  plantingLogs: (PlantingLog & { cropNameForSort: string; cropVarietyForSort: string })[];
  // seedBatches: SeedBatch[]; // Removed
  // crops: Crop[]; // Removed
  // inputInventory: InputInventory[]; // Removed
  // purchasedSeedlings: PurchasedSeedling[]; // Removed
  // seedlingProductionLogs: SeedlingProductionLog[]; // Removed
  onEdit: (log: PlantingLog) => void;
  onDelete: (id: string) => Promise<void>;
  onMarkCompleted: (id: string) => Promise<void>;
  isDeleting: string | null;
  isCompleting: string | null;
}

export default function PlantingLogList({
  plantingLogs,
  // seedBatches, // Removed
  // crops, // Removed
  // inputInventory, // Removed
  // purchasedSeedlings, // Removed
  // seedlingProductionLogs, // Removed
  onEdit,
  onDelete,
  onMarkCompleted,
  isDeleting,
  isCompleting
}: PlantingLogListProps) {

  // const getCropDetails = (log: PlantingLog) => { ... }; // Removed

  const activePlantingLogs = plantingLogs.filter(log => log.is_deleted !== 1);

  if (activePlantingLogs.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No active planting logs found. Record your first planting event!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Planting Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Crop</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Variety</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Location</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Qty Planted</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Expected Harvest</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Status</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activePlantingLogs.map((log) => {
            // const { cropName, cropVariety } = getCropDetails(log); // Use pre-enriched data
            const cropName = log.cropNameForSort;
            const cropVariety = log.cropVarietyForSort || <span className="text-gray-400">N/A</span>;
            return (
              <tr key={log.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">{formatDateToDDMMYYYY(log.planting_date)}</td>
                <td className="py-3 px-5">{cropName}</td>
                <td className="py-3 px-5">{cropVariety}</td>
                <td className="py-3 px-5">{log.location_description || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{log.quantity_planted}</td>
              <td className="py-3 px-5">{log.quantity_unit || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5">{log.expected_harvest_date ? formatDateToDDMMYYYY(log.expected_harvest_date) : <span className="text-gray-400">N/A</span>}</td>
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
              <td className="py-3 px-5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  log.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                  log.status === 'active' || !log.status ? 'bg-blue-100 text-blue-800' : // Treat undefined/null as active
                  log.status === 'terminated' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800' // Default for other statuses
                }`}>
                  {log.status ? log.status.charAt(0).toUpperCase() + log.status.slice(1) : 'Active'}
                </span>
              </td>
              <td className="py-3 px-5 text-center whitespace-nowrap">
                {(log.status === 'active' || !log.status) && (
                  <button
                    onClick={() => onMarkCompleted(log.id)}
                    className="text-green-600 hover:text-green-800 font-medium mr-3 transition-colors duration-150 disabled:opacity-50"
                    disabled={isCompleting === log.id || isDeleting === log.id}
                  >
                    {isCompleting === log.id ? 'Completing...' : 'Mark Completed'}
                  </button>
                )}
                <button
                  onClick={() => onEdit(log)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isCompleting === log.id || isDeleting === log.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(log.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isCompleting === log.id || isDeleting === log.id}
                >
                  {isDeleting === log.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}