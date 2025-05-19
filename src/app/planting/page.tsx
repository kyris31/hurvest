'use client';

import React, { useState } from 'react'; // Removed useEffect, useCallback
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PlantingLog } from '@/lib/db'; // Removed unused SeedBatch, Crop
import PlantingLogList from '@/components/PlantingLogList';
import PlantingLogForm from '@/components/PlantingLogForm';

// syncCounter prop is no longer needed with useLiveQuery
export default function PlantingLogsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<PlantingLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // For form submission errors

  const plantingLogs = useLiveQuery(
    async () => {
      try {
        return await db.plantingLogs.orderBy('planting_date').filter(pl => pl.is_deleted === 0).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch planting logs with useLiveQuery:", err);
        setError("Failed to load planting logs. Please try again.");
        return [];
      }
    },
    []
  );

  const seedBatches = useLiveQuery(
    async () => {
      try {
        return await db.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch seed batches for PlantingLogsPage:", err);
        // setError("Failed to load seed batch data."); // Avoid overwriting primary error
        return [];
      }
    },
    []
  );

  const crops = useLiveQuery(
    async () => {
      try {
        return await db.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray();
      } catch (err) {
        console.error("Failed to fetch crops for PlantingLogsPage:", err);
        // setError("Failed to load crop data."); // Avoid overwriting primary error
        return [];
      }
    },
    []
  );

  const isLoading = plantingLogs === undefined || seedBatches === undefined || crops === undefined;

  const handleFormSubmit = async (data: Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | PlantingLog) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      let plantingLogId: string | undefined = undefined;

      if ('id' in data && data.id) { // Editing existing
        // Note: Updating current_quantity for edited logs is complex.
        // If the seed batch or quantity planted changes, we'd need to revert the old deduction
        // and apply the new one. For simplicity, this example doesn't handle that rollback/reapply.
        // This assumes that once a planting log is created, its impact on seed batch quantity is fixed.
        const updatedLog: Partial<PlantingLog> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.plantingLogs.update(data.id, updatedLog);
        plantingLogId = data.id; // Keep track for potential (though not implemented here) quantity adjustments
      } else { // Adding new
        const newLogData: Omit<PlantingLog, 'id'> = {
          ...(data as Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        plantingLogId = crypto.randomUUID();
        await db.plantingLogs.add({ ...newLogData, id: plantingLogId });

        // Decrement seed batch quantity if a batch was used
        if (data.seed_batch_id && data.quantity_planted && data.quantity_planted > 0) {
          const batch = await db.seedBatches.get(data.seed_batch_id);
          if (batch) {
            const currentQty = batch.current_quantity ?? batch.initial_quantity ?? 0;
            const newQuantity = Math.max(0, currentQty - data.quantity_planted);
            await db.seedBatches.update(data.seed_batch_id, {
              current_quantity: newQuantity,
              _synced: 0, // Mark batch for sync as its quantity changed
              _last_modified: Date.now()
            });
          }
        }
      }
      setShowForm(false);
      setEditingLog(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save planting log. Please try again.";
      console.error("Failed to save planting log:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: PlantingLog) => {
    setEditingLog(log);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this planting log? This may affect associated cultivation and harvest logs.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync('plantingLogs', id, {}, true);
        // Soft deleting a planting log might orphan cultivation/harvest logs.
        // The UI for those sections should handle displaying "Unknown Planting Log" or similar.
        // await fetchData(); // No longer needed
      } catch (err) {
        console.error("Failed to delete planting log:", err);
        setError("Failed to delete planting log.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Planting Logs</h1>
          <button
            onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Record New Planting
          </button>
        </div>
      </header>

      {showForm && (
        <PlantingLogForm
          initialData={editingLog}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingLog(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading planting logs...</p>}
        {!isLoading && !error && plantingLogs && seedBatches && crops && (
          <PlantingLogList
            plantingLogs={plantingLogs}
            seedBatches={seedBatches}
            crops={crops}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && plantingLogs && plantingLogs.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 9.75v2.25m0 0l-2.25 2.25M12.75 12l2.25-2.25M12.75 12l2.25 2.25M12.75 12l-2.25-2.25M7.5 15h9M7.5 12h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm3.75 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm3.75 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No planting logs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a new planting event.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record New Planting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}