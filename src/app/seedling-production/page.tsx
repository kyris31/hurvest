'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, SeedlingProductionLog } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';
// import Layout from '@/components/Layout'; // No longer needed here
import SeedlingProductionForm from '@/components/SeedlingProductionForm';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

// Interface to hold enriched data for display
interface EnrichedSeedlingProductionLog extends SeedlingProductionLog {
  cropName?: string;
  cropVariety?: string;
  seedBatchCode?: string;
}

export default function SeedlingProductionPage() {
  const [logs, setLogs] = useState<EnrichedSeedlingProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingLog, setEditingLog] = useState<SeedlingProductionLog | null>(null);

  const fetchSeedlingProductionLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all necessary data upfront
      const [allLogsRaw, allCropsData, allSeedBatchesData] = await Promise.all([
        db.seedlingProductionLogs.where('is_deleted').notEqual(1).toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray()
      ]);

      const cropsMap = new Map(allCropsData.map(crop => [crop.id, crop]));
      const seedBatchesMap = new Map(allSeedBatchesData.map(sb => [sb.id, sb]));

      const enrichedLogs: EnrichedSeedlingProductionLog[] = allLogsRaw.map(log => {
        let cropName = 'N/A';
        let cropVariety = '';
        let seedBatchCode = 'N/A';

        const cropFromLog = log.crop_id ? cropsMap.get(log.crop_id) : undefined;

        if (cropFromLog) {
            cropName = cropFromLog.name;
            cropVariety = cropFromLog.variety || '';
        }

        if (log.seed_batch_id) {
          const seedBatch = seedBatchesMap.get(log.seed_batch_id);
          if (seedBatch) {
            seedBatchCode = seedBatch.batch_code;
            // If cropName is still N/A, try to get it from seedBatch's crop_id
            if (cropName === 'N/A' && seedBatch.crop_id) {
              const cropFromBatch = cropsMap.get(seedBatch.crop_id);
              if (cropFromBatch) {
                cropName = cropFromBatch.name;
                cropVariety = cropFromBatch.variety || '';
              }
            }
          }
        }
        return { ...log, cropName, cropVariety, seedBatchCode };
      });

      // Filter out logs with no available seedlings
      const activeEnrichedLogs = enrichedLogs.filter(log => (log.current_seedlings_available || 0) > 0);

      // Sort activeEnrichedLogs alphabetically by cropName (locale-sensitive), then by sowing_date descending
      activeEnrichedLogs.sort((a, b) => {
        // Primary sort: cropName, locale-sensitive
        const nameComparison = (a.cropName || '').localeCompare(b.cropName || '', undefined, { sensitivity: 'base' });
        if (nameComparison !== 0) {
          return nameComparison;
        }
        // Secondary sort: sowing_date (newest first)
        const dateA = new Date(a.sowing_date).getTime();
        const dateB = new Date(b.sowing_date).getTime();
        return dateB - dateA; // Newest first for same crop name
      });

      setLogs(activeEnrichedLogs);
    } catch (err) {
      console.error("Failed to fetch seedling production logs:", err);
      setError("Failed to load seedling production records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeedlingProductionLogs();
  }, [fetchSeedlingProductionLogs]);

  const handleAddLog = () => {
    setEditingLog(null);
    setShowFormModal(true);
  };

  const handleEditLog = (log: SeedlingProductionLog) => {
    setEditingLog(log);
    setShowFormModal(true);
  };

  const handleDeleteLog = async (id: string) => {
    if (confirm('Are you sure you want to delete this sowing record? This action cannot be undone.')) {
      try {
        await db.seedlingProductionLogs.update(id, { is_deleted: 1, deleted_at: new Date().toISOString(), _synced: 0, _last_modified: Date.now() });
        fetchSeedlingProductionLogs(); // Refresh list
        // After successful local delete marking, request a push to the server
        try {
            console.log("SeedlingProductionPage: Push requesting after delete...");
            const pushResult = await requestPushChanges();
            if (pushResult.success) {
                console.log("SeedlingProductionPage: Push requested successfully after delete.");
            } else {
                console.error("SeedlingProductionPage: Push request failed after delete.", pushResult.errors);
            }
        } catch (syncError) {
            console.error("Error requesting push after seedling log delete:", syncError);
        }
        // Note: Logic to handle impact on SeedBatch.current_quantity if seeds were "returned" would be complex and is not handled here.
        // Similarly, impact on linked PlantingLogs if seedlings were already transplanted.
      } catch (err) {
        console.error("Failed to delete seedling production log:", err);
        alert("Failed to delete record. Please try again.");
      }
    }
  };
  
  const handleFormClose = (refresh?: boolean) => {
    setShowFormModal(false);
    setEditingLog(null);
    if (refresh) {
      fetchSeedlingProductionLogs();
    }
  };

  if (isLoading) {
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Seedling Production Logs</h1><p>Loading records...</p></div>;
  }

  if (error) {
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Seedling Production Logs</h1><p className="text-red-500">{error}</p></div>;
  }

  return (
    // <Layout> // Removed Layout wrapper
      <div className="p-4 md:p-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Seedling Production Logs</h1>
            <button
              onClick={handleAddLog}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <PlusCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              New Sowing Record
            </button>
          </div>
        </header>

        {/* Form Modal Placeholder - Will be implemented with SeedlingProductionForm */}
        {showFormModal && (
          <div className="fixed inset-0 z-10 overflow-y-auto bg-gray-500 bg-opacity-75 transition-opacity">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4" id="modal-title">
                          {editingLog ? 'Edit Sowing Record' : 'Add New Sowing Record'}
                        </h3>
                        <SeedlingProductionForm existingLog={editingLog} onClose={handleFormClose} />
                      </div>
                    </div>
                  </div>
                  {/* Modal footer for cancel button can be part of the form or here if needed */}
                  {/* <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="button" onClick={() => handleFormClose(false)} className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                  </div> */}
                </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-white shadow sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sowing Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variety</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seed Batch</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seeds Sown</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nursery Loc.</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seedlings Produced</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length > 0 ? logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(log.sowing_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.cropName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.cropVariety}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.seedBatchCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.quantity_sown_value} {log.sowing_unit_from_batch}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.nursery_location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.actual_seedlings_produced}
                    {log.estimated_total_individual_seeds_sown && log.estimated_total_individual_seeds_sown > 0 &&
                      ` (${((log.actual_seedlings_produced / log.estimated_total_individual_seeds_sown) * 100).toFixed(0)}%)`
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.current_seedlings_available}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => handleEditLog(log)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                    <button onClick={() => handleDeleteLog(log.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">No seedling production records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    // </Layout> // Removed Layout wrapper
  );
}