'use client';

import React, { useState } from 'react'; // Removed useEffect, useCallback
import { useLiveQuery } from 'dexie-react-hooks';
import { db, HarvestLog } from '@/lib/db'; // Removed unused PlantingLog, SeedBatch, Crop
import HarvestLogList from '@/components/HarvestLogList';
import HarvestLogForm from '@/components/HarvestLogForm';
import { exportHarvestLogsToCSV, exportHarvestLogsToPDF } from '@/lib/reportUtils';

// syncCounter prop is no longer needed with useLiveQuery
export default function HarvestLogsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<HarvestLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // For form submission errors

  const harvestLogs = useLiveQuery(
    async () => {
      try {
        return await db.harvestLogs.orderBy('harvest_date').filter(hl => hl.is_deleted === 0).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch harvest logs with useLiveQuery:", err);
        setError("Failed to load harvest logs. Please try again.");
        return [];
      }
    },
    []
  );

  const plantingLogs = useLiveQuery(
    async () => {
      try {
        return await db.plantingLogs.orderBy('planting_date').filter(pl => pl.is_deleted === 0).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch planting logs for HarvestLogsPage:", err);
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
        console.error("Failed to fetch seed batches for HarvestLogsPage:", err);
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
        console.error("Failed to fetch crops for HarvestLogsPage:", err);
        return [];
      }
    },
    []
  );

  const isLoading = harvestLogs === undefined || plantingLogs === undefined || seedBatches === undefined || crops === undefined;

  const handleFormSubmit = async (data: Omit<HarvestLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | HarvestLog) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if ('id' in data && data.id) { // Editing existing
        const updatedLog: Partial<HarvestLog> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.harvestLogs.update(data.id, updatedLog);
      } else { // Adding new
        const newLogData: Omit<HarvestLog, 'id'> = {
          ...(data as Omit<HarvestLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.harvestLogs.add({ ...newLogData, id });
      }
      // await fetchData(); // No longer needed
      setShowForm(false);
      setEditingLog(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save harvest log. Please try again.";
      console.error("Failed to save harvest log:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: HarvestLog) => {
    setEditingLog(log);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this harvest log? This may affect sales records if this harvest was sold.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync(db.harvestLogs, id, true);
        // Deleting a harvest log could affect sales if items from this harvest were sold.
        // The sales form/list should gracefully handle missing harvest logs.
        // await fetchData(); // No longer needed
      } catch (err) {
        console.error("Failed to delete harvest log:", err);
        setError("Failed to delete harvest log.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Harvest Logs</h1>
            <div className="flex space-x-3">
              <button
                onClick={() => exportHarvestLogsToCSV()} // Pass empty/null filters if no UI for them here
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Harvest Logs (CSV)
              </button>
              <button
                onClick={() => exportHarvestLogsToPDF()} // Pass empty/null filters if no UI for them here
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Harvest Logs (PDF)
              </button>
              <button
                onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Record New Harvest
              </button>
            </div>
          </div>
        </div>
      </header>

      {showForm && (
        <HarvestLogForm
          initialData={editingLog}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingLog(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading harvest logs...</p>}
        {!isLoading && !error && harvestLogs && plantingLogs && seedBatches && crops && (
          <HarvestLogList
            harvestLogs={harvestLogs}
            plantingLogs={plantingLogs}
            seedBatches={seedBatches}
            crops={crops}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && harvestLogs && harvestLogs.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.001c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No harvest logs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a new harvest.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record New Harvest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}