'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import type { FlockRecord } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';

interface FlockRecordFormProps {
  flockId: string;
  initialData?: FlockRecord | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

const recordTypes: FlockRecord['record_type'][] = [
  'vaccination', 'illness', 'treatment', 'mortality',
  'cull_sale', 'weight_check', 'egg_collection', 'egg_sale', 'other' // Added 'egg_sale'
];

export default function FlockRecordForm({ flockId, initialData, onSubmitSuccess, onCancel }: FlockRecordFormProps) {
  const [recordDate, setRecordDate] = useState('');
  const [recordType, setRecordType] = useState<FlockRecord['record_type']>('other');
  const [details, setDetails] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [weightKgTotal, setWeightKgTotal] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [revenue, setRevenue] = useState<number | ''>(''); // New state for revenue
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialData) {
      setRecordDate(initialData.record_date ? initialData.record_date.split('T')[0] : '');
      setRecordType(initialData.record_type);
      setDetails(initialData.details);
      setQuantity(initialData.quantity ?? '');
      setWeightKgTotal(initialData.weight_kg_total ?? '');
      setCost(initialData.cost ?? '');
      setRevenue(initialData.revenue ?? ''); // Set new state
      setOutcome(initialData.outcome || '');
      setNotes(initialData.notes || '');
    } else {
      setRecordDate(new Date().toISOString().split('T')[0]); // Default to today
      setRecordType('other');
      setDetails('');
      setQuantity('');
      setWeightKgTotal('');
      setCost('');
      setRevenue(''); // Reset new state
      setOutcome('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsProcessing(true);

    if (!recordDate) {
      setError("Record date is required.");
      setIsProcessing(false);
      return;
    }
    if (!details.trim() && recordType !== 'mortality' && recordType !== 'egg_collection' && recordType !== 'cull_sale' && recordType !== 'weight_check') {
      // Details might be optional for some record types that primarily use quantity
      // setError("Details are required.");
      // setIsProcessing(false);
      // return;
    }
     if (quantity !== '' && isNaN(Number(quantity))) {
        setError("Quantity must be a number.");
        setIsProcessing(false);
        return;
    }


    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if (initialData?.id) { // Editing existing record
        const updates: Partial<FlockRecord> = {
          record_date: recordDate,
          record_type: recordType,
          details,
          quantity: quantity === '' ? undefined : Number(quantity),
          weight_kg_total: (recordType === 'cull_sale' || recordType === 'weight_check') && weightKgTotal !== '' ? Number(weightKgTotal) : undefined,
          cost: cost === '' ? undefined : Number(cost),
          revenue: (recordType === 'cull_sale' || recordType === 'egg_sale') && revenue !== '' ? Number(revenue) : undefined, // Add revenue
          outcome: outcome || undefined,
          notes: notes || undefined,
          updated_at: now,
        };
        await db.flock_records.update(initialData.id, updates);
        await db.markForSync('flock_records', initialData.id, updates);
        console.log(`Flock record ${initialData.id} updated and marked for sync.`);
      } else { // Adding new record
        const newRecordData: Omit<FlockRecord, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> = {
          flock_id: flockId,
          record_date: recordDate,
          record_type: recordType,
          details,
          quantity: quantity === '' ? undefined : Number(quantity),
          weight_kg_total: (recordType === 'cull_sale' || recordType === 'weight_check') && weightKgTotal !== '' ? Number(weightKgTotal) : undefined,
          cost: cost === '' ? undefined : Number(cost),
          revenue: (recordType === 'cull_sale' || recordType === 'egg_sale') && revenue !== '' ? Number(revenue) : undefined, // Add revenue
          outcome: outcome || undefined,
          notes: notes || undefined,
        };
        
        const id = crypto.randomUUID();
        const recordToAdd: FlockRecord = {
            ...newRecordData,
            id,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
        };
        await db.flock_records.add(recordToAdd);
        console.log(`New flock record ${id} for flock ${flockId} added and marked for sync.`);
      }
      await requestPushChanges();
      onSubmitSuccess();
    } catch (err) {
      console.error("Failed to save flock record:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="my-4 p-4 bg-white shadow rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-gray-700">
        {initialData ? 'Edit Flock Record' : 'Add New Flock Record'}
      </h3>
      {error && <p className="text-red-500 mb-3 p-2 bg-red-50 rounded-md">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recordDate" className="block text-sm font-medium text-gray-700">Record Date <span className="text-red-500">*</span></label>
          <input type="date" name="recordDate" id="recordDate" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div>
          <label htmlFor="recordType" className="block text-sm font-medium text-gray-700">Record Type</label>
          <select name="recordType" id="recordType" value={recordType} onChange={(e) => setRecordType(e.target.value as FlockRecord['record_type'])}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            {recordTypes.map(type => (
              <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="details" className="block text-sm font-medium text-gray-700">Details <span className="text-red-500">*</span></label>
          <textarea name="details" id="details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity (e.g., #birds, #eggs)</label>
          <input type="number" name="quantity" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} min="0"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        {(recordType === 'cull_sale' || recordType === 'weight_check') && (
          <div>
            <label htmlFor="weightKgTotal" className="block text-sm font-medium text-gray-700">
              Total Weight (kg) {recordType === 'cull_sale' ? ' (for culled/sold birds)' : '(for weight check)'}
            </label>
            <input type="number" name="weightKgTotal" id="weightKgTotal" value={weightKgTotal}
              onChange={(e) => setWeightKgTotal(e.target.value === '' ? '' : Number(e.target.value))}
              min="0" step="0.01"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
        )}

        {(recordType === 'vaccination' || recordType === 'treatment' || recordType === 'illness') && (
          <div>
            <label htmlFor="cost" className="block text-sm font-medium text-gray-700">
              Cost (€) {recordType === 'vaccination' ? '(Vaccine/Labor)' : recordType === 'treatment' ? '(Medication/Vet)' : '(Diagnostics/Etc.)'}
            </label>
            <input type="number" name="cost" id="cost" value={cost}
              onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
              min="0" step="0.01"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
        )}

        <div>
          <label htmlFor="outcome" className="block text-sm font-medium text-gray-700">Outcome (e.g., Recovered, Sold)</label>
          <input type="text" name="outcome" id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea name="notes" id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Cancel
          </button>
          <button type="submit" disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            {isProcessing ? 'Saving...' : (initialData ? 'Update Record' : 'Add Record')}
          </button>
        </div>
      </form>
    </div>
  );
}