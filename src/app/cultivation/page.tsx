'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, CultivationLog, PlantingLog, SeedBatch, Crop, InputInventory } from '@/lib/db';
import CultivationLogList from '@/components/CultivationLogList';
import CultivationLogForm from '@/components/CultivationLogForm';

export default function CultivationLogsPage() {
  const [cultivationLogs, setCultivationLogs] = useState<CultivationLog[]>([]);
  const [plantingLogs, setPlantingLogs] = useState<PlantingLog[]>([]);
  const [seedBatches, setSeedBatches] = useState<SeedBatch[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [inputInventory, setInputInventory] = useState<InputInventory[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<CultivationLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cLogsData, pLogsData, sBatchesData, crpsData, inputsData] = await Promise.all([
        db.cultivationLogs.orderBy('activity_date').filter(cl => cl.is_deleted === 0).reverse().toArray(),
        db.plantingLogs.orderBy('planting_date').filter(pl => pl.is_deleted === 0).reverse().toArray(),
        db.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray(),
        db.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
        db.inputInventory.orderBy('name').filter(ii => ii.is_deleted === 0).toArray()
      ]);
      setCultivationLogs(cLogsData);
      setPlantingLogs(pLogsData);
      setSeedBatches(sBatchesData);
      setCrops(crpsData);
      setInputInventory(inputsData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch cultivation data:", err);
      setError("Failed to load cultivation logs or related data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormSubmit = async (data: Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | CultivationLog) => {
    setIsSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const logId = ('id' in data && data.id) ? data.id : crypto.randomUUID();

    try {
      await db.transaction('rw', db.cultivationLogs, db.inputInventory, async () => {
        let previousInputId: string | undefined = undefined;
        let previousInputQtyUsed: number | undefined = undefined;

        if ('id' in data && data.id) { // Editing existing log
          const oldLog = await db.cultivationLogs.get(data.id);
          if (oldLog && oldLog.input_inventory_id && oldLog.input_quantity_used) {
            // Store old values to revert if input item changes or quantity changes
            previousInputId = oldLog.input_inventory_id;
            previousInputQtyUsed = oldLog.input_quantity_used;
          }

          // If the input item or quantity used has changed, revert the old usage first
          if (previousInputId && previousInputQtyUsed &&
              (previousInputId !== data.input_inventory_id || previousInputQtyUsed !== data.input_quantity_used)) {
            const oldAffectedInput = await db.inputInventory.get(previousInputId);
            if (oldAffectedInput) {
              await db.inputInventory.update(previousInputId, {
                current_quantity: (oldAffectedInput.current_quantity ?? 0) + previousInputQtyUsed,
                _synced: 0,
                _last_modified: Date.now()
              });
            }
          }
          
          const updatedLog: Partial<CultivationLog> = { ...data, updated_at: now, _synced: 0, _last_modified: Date.now() };
          await db.cultivationLogs.update(data.id, updatedLog);
        } else { // Adding new log
          const newLogData: CultivationLog = {
            ...(data as Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
            id: logId,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: Date.now(),
            is_deleted: 0,
            deleted_at: undefined,
          };
          await db.cultivationLogs.add(newLogData);
        }

        // Apply new input usage (for both add and relevant edits)
        if (data.input_inventory_id && data.input_quantity_used && data.input_quantity_used > 0) {
          const affectedInputItem = await db.inputInventory.get(data.input_inventory_id);
          if (!affectedInputItem) {
            throw new Error(`Input item with ID ${data.input_inventory_id} not found.`);
          }
          const newQuantity = (affectedInputItem.current_quantity ?? 0) - data.input_quantity_used;
          if (newQuantity < 0) {
            throw new Error(`Not enough stock for ${affectedInputItem.name}. Available: ${affectedInputItem.current_quantity ?? 0}, Tried to use: ${data.input_quantity_used}.`);
          }
          await db.inputInventory.update(data.input_inventory_id, {
            current_quantity: newQuantity,
            _synced: 0,
            _last_modified: Date.now()
          });
        }
      }); // End transaction

      await fetchData();
      setShowForm(false);
      setEditingLog(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save cultivation log. Please try again.";
      console.error("Failed to save cultivation log:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: CultivationLog) => {
    setEditingLog(log);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this cultivation log? This may affect inventory if inputs were used.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.transaction('rw', db.cultivationLogs, db.inputInventory, async () => {
          const logToDelete = await db.cultivationLogs.get(id);
          if (logToDelete && logToDelete.input_inventory_id && logToDelete.input_quantity_used) {
              const affectedInput = await db.inputInventory.get(logToDelete.input_inventory_id);
              if (affectedInput) {
                  await db.inputInventory.update(logToDelete.input_inventory_id, {
                      current_quantity: (affectedInput.current_quantity ?? 0) + logToDelete.input_quantity_used,
                      _synced: 0,
                      _last_modified: Date.now()
                  });
              }
          }
          await db.markForSync('cultivationLogs', id, {}, true); // Correcting based on identified signature Vercel uses
        });
        await fetchData();
      } catch (err) {
        console.error("Failed to delete cultivation log:", err);
        setError("Failed to delete cultivation log.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cultivation Logs</h1>
          <button
            onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Record Cultivation Activity
          </button>
        </div>
      </header>

      {showForm && (
        <CultivationLogForm
          initialData={editingLog}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingLog(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading cultivation logs...</p>}
        {!isLoading && !error && (
          <CultivationLogList
            cultivationLogs={cultivationLogs}
            plantingLogs={plantingLogs}
            seedBatches={seedBatches}
            crops={crops}
            inputInventory={inputInventory}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && cultivationLogs.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m3 0H3m2.25 0l3 2.25M3.75 12m0 0V7.5m0 4.5V12m0 0h16.5m0 0l-3-2.25m3 2.25l-3 2.25M12 3.75l3 2.25-3 2.25m3 0V3.75m0 0l3 2.25m-3-2.25l3-2.25m0 0l3 2.25M3.75 12h16.5" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No cultivation logs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a cultivation activity.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record Cultivation Activity
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}