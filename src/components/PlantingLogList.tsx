'use client';

import React from 'react';
import { PlantingLog, SeedBatch, Crop } from '@/lib/db';

interface PlantingLogListProps {
  plantingLogs: PlantingLog[];
  seedBatches: SeedBatch[];
  crops: Crop[];
  onEdit: (log: PlantingLog) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; 
}

export default function PlantingLogList({ plantingLogs, seedBatches, crops, onEdit, onDelete, isDeleting }: PlantingLogListProps) {

  const getSeedBatchInfo = (seedBatchId?: string) => {
    if (!seedBatchId) return <span className="text-gray-400">N/A</span>;
    // Ensure seedBatches and crops lists are filtered for active items if not guaranteed by parent
    const activeSeedBatches = seedBatches.filter(sb => sb.is_deleted !== 1);
    const activeCrops = crops.filter(c => c.is_deleted !== 1);

    const batch = activeSeedBatches.find(b => b.id === seedBatchId);
    if (!batch) return 'Unknown/Deleted Batch';
    const crop = activeCrops.find(c => c.id === batch.crop_id);
    return `${batch.batch_code} (${crop ? crop.name : 'Unknown/Deleted Crop'})`;
  };

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
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Seed Batch (Crop)</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Location</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Qty Planted</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Expected Harvest</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activePlantingLogs.map((log) => (
            <tr key={log.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{new Date(log.planting_date).toLocaleDateString()}</td>
              <td className="py-3 px-5">{getSeedBatchInfo(log.seed_batch_id)}</td>
              <td className="py-3 px-5">{log.location_description || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-right">{log.quantity_planted}</td>
              <td className="py-3 px-5">{log.quantity_unit || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5">{log.expected_harvest_date ? new Date(log.expected_harvest_date).toLocaleDateString() : <span className="text-gray-400">N/A</span>}</td>
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