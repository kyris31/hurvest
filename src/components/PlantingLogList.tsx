'use client';

import React from 'react';
import { PlantingLog, SeedBatch, Crop, InputInventory, PurchasedSeedling } from '@/lib/db'; // Added PurchasedSeedling

interface PlantingLogListProps {
  plantingLogs: PlantingLog[];
  seedBatches: SeedBatch[];
  crops: Crop[];
  inputInventory: InputInventory[];
  purchasedSeedlings: PurchasedSeedling[]; // Added purchasedSeedlings prop
  onEdit: (log: PlantingLog) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function PlantingLogList({
  plantingLogs,
  seedBatches,
  crops,
  inputInventory,
  purchasedSeedlings, // Destructure new prop
  onEdit,
  onDelete,
  isDeleting
}: PlantingLogListProps) {

  const getCropDetails = (log: PlantingLog) => {
    const activeCrops = crops.filter(c => c.is_deleted !== 1);

    if (log.purchased_seedling_id) {
      const purchasedSeedling = purchasedSeedlings.find(ps => ps.id === log.purchased_seedling_id && ps.is_deleted !== 1);
      if (purchasedSeedling?.crop_id) {
        const crop = activeCrops.find(c => c.id === purchasedSeedling.crop_id);
        if (crop) return { cropName: crop.name, cropVariety: crop.variety || <span className="text-gray-400">N/A</span> };
        return { cropName: <span className="text-red-500">Crop for Purchased Seedling Not Found</span>, cropVariety: <span className="text-gray-400">N/A</span> };
      }
      // If purchased seedling has no crop_id, use its name.
      return { cropName: purchasedSeedling?.name || <span className="text-red-500">Unknown Purchased Seedling</span>, cropVariety: <span className="text-gray-400">N/A</span> };
    } else if (log.seed_batch_id) {
      const batch = seedBatches.find(b => b.id === log.seed_batch_id && b.is_deleted !== 1);
      if (!batch) return { cropName: <span className="text-red-500">Unknown Seed Batch</span>, cropVariety: <span className="text-gray-400">N/A</span> };
      const crop = activeCrops.find(c => c.id === batch.crop_id);
      if (!crop) return { cropName: <span className="text-red-500">Crop for Seed Batch Not Found</span>, cropVariety: <span className="text-gray-400">N/A</span> };
      return { cropName: crop.name, cropVariety: crop.variety || <span className="text-gray-400">N/A</span> };
    } else if (log.input_inventory_id) { // Fallback for older direct input inventory plantings (if any)
      const invItem = inputInventory.find(ii => ii.id === log.input_inventory_id && ii.is_deleted !== 1);
      if (!invItem) return { cropName: <span className="text-red-500">Unknown Inventory Item</span>, cropVariety: <span className="text-gray-400">N/A</span> };
      if (invItem.crop_id) {
        const crop = activeCrops.find(c => c.id === invItem.crop_id);
        if (!crop) return { cropName: <span className="text-red-500">Crop for Inventory Item Not Found</span>, cropVariety: <span className="text-gray-400">N/A</span> };
        return { cropName: crop.name, cropVariety: crop.variety || <span className="text-gray-400">N/A</span> };
      }
      return { cropName: invItem.name, cropVariety: <span className="text-gray-400">N/A</span> };
    } else if (log.seedling_production_log_id) {
      // This case needs access to seedlingProductionLogs, which are not currently passed as a prop.
      // For now, it will likely fall through or need seedlingProductionLogs to be passed.
      // Or, seedling_production_log should always also have a seed_batch_id or crop_id.
      return { cropName: <span className="text-orange-500">From Seedling Prod. (Details N/A)</span>, cropVariety: <span className="text-gray-400">N/A</span> };
    }
    
    return { cropName: <span className="text-gray-400">N/A</span>, cropVariety: <span className="text-gray-400">N/A</span> };
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
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Crop</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Variety</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Location</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Qty Planted</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Expected Harvest</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activePlantingLogs.map((log) => {
            const { cropName, cropVariety } = getCropDetails(log); // Pass the whole log object
            return (
              <tr key={log.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">{new Date(log.planting_date).toLocaleDateString()}</td>
                <td className="py-3 px-5">{cropName}</td>
                <td className="py-3 px-5">{cropVariety}</td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}