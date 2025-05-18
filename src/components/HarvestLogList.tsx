'use client';

import React from 'react';
import { HarvestLog, PlantingLog, SeedBatch, Crop } from '@/lib/db';

interface HarvestLogListProps {
  harvestLogs: HarvestLog[];
  plantingLogs: PlantingLog[];
  seedBatches: SeedBatch[];
  crops: Crop[];
  onEdit: (log: HarvestLog) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; 
}

export default function HarvestLogList({ 
  harvestLogs, 
  plantingLogs, 
  seedBatches, 
  crops, 
  onEdit, 
  onDelete, 
  isDeleting 
}: HarvestLogListProps) {

  const getPlantingLogInfo = (plantingLogId: string) => {
    const activePlantingLogs = plantingLogs.filter(pl => pl.is_deleted !== 1);
    const activeSeedBatches = seedBatches.filter(sb => sb.is_deleted !== 1);
    const activeCrops = crops.filter(c => c.is_deleted !== 1);

    const pLog = activePlantingLogs.find(pl => pl.id === plantingLogId);
    if (!pLog) return 'Unknown/Deleted Planting Log';
    let cropName = 'N/A';
    if (pLog.seed_batch_id) {
      const sBatch = activeSeedBatches.find(sb => sb.id === pLog.seed_batch_id);
      if (sBatch) {
        const crop = activeCrops.find(c => c.id === sBatch.crop_id);
        if (crop) cropName = crop.name;
      } else {
        cropName = 'Unknown/Deleted Crop (from Batch)';
      }
    }
    return `${new Date(pLog.planting_date).toLocaleDateString()} - ${cropName} (${pLog.location_description || 'N/A'})`;
  };

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
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Planting Log (Crop - Location)</th>
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
              <td className="py-3 px-5">{new Date(log.harvest_date).toLocaleDateString()}</td>
              <td className="py-3 px-5">{getPlantingLogInfo(log.planting_log_id)}</td>
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