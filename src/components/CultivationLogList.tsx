'use client';

import React from 'react';
import { CultivationLog, PlantingLog, InputInventory, SeedBatch, Crop, CultivationActivityUsedInput, CultivationActivityPlantingLink } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils'; // Import the date formatting utility

// Interface for enriched PlantingLog object
interface EnrichedPlantingLog extends PlantingLog {
  cropName?: string;
  displayLabel?: string;
}

interface CultivationLogListProps {
  cultivationLogs: CultivationLog[];
  plantingLogs: PlantingLog[];
  seedBatches: SeedBatch[];
  crops: Crop[];
  inputInventory: InputInventory[];
  activityUsedInputs: CultivationActivityUsedInput[];
  activityPlantingLinks: CultivationActivityPlantingLink[]; // Added prop
  onEdit: (log: CultivationLog) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function CultivationLogList({
  cultivationLogs,
  plantingLogs,
  seedBatches,
  crops,
  inputInventory,
  activityUsedInputs,
  activityPlantingLinks, // Added prop
  onEdit,
  onDelete,
  isDeleting
}: CultivationLogListProps) {

  const getPlantingLogInfo = (cultivationLogId: string) => {
    console.log(`[CultivationLogList] getPlantingLogInfo called for cultLogId: ${cultivationLogId}`);
    const activePlantingLinks = activityPlantingLinks.filter(apl => apl.is_deleted !== 1);
    const link = activePlantingLinks.find(apl => apl.cultivation_log_id === cultivationLogId);

    if (!link || !link.planting_log_id) {
      console.log(`[CultivationLogList] No active link found for cultLogId: ${cultivationLogId}`);
      return 'N/A';
    }
    const plantingLogId = link.planting_log_id;
    console.log(`[CultivationLogList] Found link. PlantingLog ID: ${plantingLogId}`);

    const activePlantingLogs = plantingLogs.filter(pl => pl.is_deleted !== 1);
    const activeSeedBatches = seedBatches.filter(sb => sb.is_deleted !== 1);
    const activeCrops = crops.filter(c => c.is_deleted !== 1);

    const pLogFromState = activePlantingLogs.find(pl => pl.id === plantingLogId);
    if (!pLogFromState) {
      console.log(`[CultivationLogList] PlantingLog not found for ID: ${plantingLogId}`);
      return 'Unknown/Deleted Planting Log';
    }
    const pLog = pLogFromState as EnrichedPlantingLog; // Cast to allow access to enriched properties
    console.log(`[CultivationLogList] Found PlantingLog (casted):`, JSON.stringify(pLog, null, 2));

    let cropName = 'N/A';
    // Use pre-enriched cropName if available on the pLog object
    if (pLog.cropName) {
      cropName = pLog.cropName;
      console.log(`[CultivationLogList] Using pre-enriched cropName: ${cropName}`);
    } else if (pLog.seed_batch_id) {
      console.log(`[CultivationLogList] PlantingLog has seed_batch_id: ${pLog.seed_batch_id}, attempting lookup.`);
      const sBatch = activeSeedBatches.find(sb => sb.id === pLog.seed_batch_id);
      if (sBatch) {
        console.log(`[CultivationLogList] Found SeedBatch:`, JSON.stringify(sBatch, null, 2));
        const crop = activeCrops.find(c => c.id === sBatch.crop_id);
        if (crop) {
          cropName = crop.name;
          console.log(`[CultivationLogList] Found Crop via SeedBatch: ${cropName}`);
        } else {
          console.log(`[CultivationLogList] Crop not found for crop_id: ${sBatch.crop_id}`);
          cropName = 'Unknown/Deleted Crop';
        }
      } else {
        console.log(`[CultivationLogList] SeedBatch not found for ID: ${pLog.seed_batch_id}`);
        cropName = 'Unknown/Deleted Crop (from Batch)';
      }
    } else {
      console.log(`[CultivationLogList] PlantingLog has no pre-enriched cropName and no seed_batch_id.`);
    }
    const locationDesc = pLog.location_description || 'N/A';
    console.log(`[CultivationLogList] Location Description: ${locationDesc}`);
    const resultString = `${formatDateToDDMMYYYY(pLog.planting_date)} - ${cropName} (${locationDesc})`;
    console.log(`[CultivationLogList] Resulting string: ${resultString}`);
    return resultString;
  };

  const getInputInfo = (cultivationLogId: string) => {
    const activeInputs = inputInventory.filter(i => i.is_deleted !== 1);
    const usedInputsForLog = activityUsedInputs.filter(
      aui => aui.cultivation_log_id === cultivationLogId && aui.is_deleted !== 1
    );

    if (usedInputsForLog.length === 0) {
      return <span className="text-gray-400">N/A</span>;
    }

    return usedInputsForLog.map(usedInput => {
      const item = activeInputs.find(i => i.id === usedInput.input_inventory_id);
      const itemName = item ? item.name : 'Unknown/Deleted Input';
      return (
        <div key={usedInput.id}>
          {itemName} ({usedInput.quantity_used} {usedInput.quantity_unit})
        </div>
      );
    });
  };

  const activeCultivationLogs = cultivationLogs.filter(log => log.is_deleted !== 1);

  if (activeCultivationLogs.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No active cultivation logs found. Record your first cultivation activity!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Activity Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Planting Log (Crop - Location)</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Activity Type</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Input Used</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Qty Used</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeCultivationLogs.map((log) => (
            <tr key={log.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{formatDateToDDMMYYYY(log.activity_date)}</td>
              <td className="py-3 px-5">{getPlantingLogInfo(log.id)}</td>
              <td className="py-3 px-5">{log.activity_type}</td>
              {/* Updated to display multiple inputs if necessary, and remove separate qty/unit columns for this view */}
              <td className="py-3 px-5" colSpan={3}>{getInputInfo(log.id)}</td>
              {/* <td className="py-3 px-5 text-right">{log.input_quantity_used ?? <span className="text-gray-400">N/A</span>}</td> */}
              {/* <td className="py-3 px-5">{log.input_quantity_unit || <span className="text-gray-400">N/A</span>}</td> */}
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