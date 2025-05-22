'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import type { PreventiveMeasureSchedule } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';

interface PreventiveMeasureScheduleFormProps {
  initialData?: PreventiveMeasureSchedule | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

const targetSpeciesOptions: PreventiveMeasureSchedule['target_species'][] = ['chicken', 'turkey', 'duck', 'quail', 'other', 'all_poultry'];
// Consider fetching measure_type options dynamically or defining a comprehensive list
const measureTypeOptions: string[] = ["Vaccination", "Deworming", "Health Check", "Pest Control", "Supplement", "Other"];


export default function PreventiveMeasureScheduleForm({ initialData, onSubmitSuccess, onCancel }: PreventiveMeasureScheduleFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetSpecies, setTargetSpecies] = useState<PreventiveMeasureSchedule['target_species']>('all_poultry');
  const [measureType, setMeasureType] = useState('');
  const [triggerOffsetDays, setTriggerOffsetDays] = useState<number | ''>('');
  const [isRecurring, setIsRecurring] = useState<number>(0); // 0 for false, 1 for true
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setTargetSpecies(initialData.target_species || 'all_poultry');
      setMeasureType(initialData.measure_type || '');
      setTriggerOffsetDays(initialData.trigger_offset_days ?? '');
      setIsRecurring(initialData.is_recurring || 0);
      setRecurrenceIntervalDays(initialData.recurrence_interval_days ?? '');
      setNotes(initialData.notes || '');
    } else {
      // Reset form
      setName('');
      setDescription('');
      setTargetSpecies('all_poultry');
      setMeasureType('');
      setTriggerOffsetDays('');
      setIsRecurring(0);
      setRecurrenceIntervalDays('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsProcessing(true);

    if (!name.trim() || !measureType.trim() || triggerOffsetDays === '') {
      setError("Schedule Name, Measure Type, and Trigger Offset Days are required.");
      setIsProcessing(false);
      return;
    }
    if (isNaN(Number(triggerOffsetDays)) || Number(triggerOffsetDays) < 0) {
        setError("Trigger Offset Days must be a non-negative number.");
        setIsProcessing(false);
        return;
    }
    if (isRecurring === 1 && (recurrenceIntervalDays === '' || isNaN(Number(recurrenceIntervalDays)) || Number(recurrenceIntervalDays) <= 0)) {
        setError("Recurrence Interval Days must be a positive number if recurring.");
        setIsProcessing(false);
        return;
    }

    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      const scheduleData = {
        name: name.trim(),
        description: description.trim() || undefined,
        target_species: targetSpecies,
        measure_type: measureType.trim(),
        trigger_event: 'hatch_date' as const, // Fixed for now
        trigger_offset_days: Number(triggerOffsetDays),
        is_recurring: isRecurring,
        recurrence_interval_days: isRecurring === 1 && recurrenceIntervalDays !== '' ? Number(recurrenceIntervalDays) : undefined,
        notes: notes.trim() || undefined,
      };

      if (initialData?.id) { // Editing
        const updates: Partial<PreventiveMeasureSchedule> = {
          ...scheduleData,
          updated_at: now,
        };
        await db.preventive_measure_schedules.update(initialData.id, updates);
        await db.markForSync('preventive_measure_schedules', initialData.id, updates);
        console.log(`Preventive Measure Schedule ${initialData.id} updated.`);
      } else { // Adding new
        const id = crypto.randomUUID();
        const scheduleToAdd: PreventiveMeasureSchedule = {
            ...scheduleData,
            id,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
        };
        await db.preventive_measure_schedules.add(scheduleToAdd);
        console.log(`New Preventive Measure Schedule ${id} added.`);
      }
      await requestPushChanges();
      onSubmitSuccess();
    } catch (err) {
      console.error("Failed to save schedule:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="my-6 p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        {initialData ? 'Edit Schedule' : 'Add New Schedule'}
      </h2>
      {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Schedule Name <span className="text-red-500">*</span></label>
          <input type="text" name="name" id="name" value={name} onChange={(e) => setName(e.target.value)} required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea name="description" id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="targetSpecies" className="block text-sm font-medium text-gray-700">Target Species</label>
          <select name="targetSpecies" id="targetSpecies" value={targetSpecies} onChange={(e) => setTargetSpecies(e.target.value as PreventiveMeasureSchedule['target_species'])}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            {targetSpeciesOptions.map(opt => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="measureType" className="block text-sm font-medium text-gray-700">Measure Type <span className="text-red-500">*</span></label>
          <input list="measure-types" name="measureType" id="measureType" value={measureType} onChange={(e) => setMeasureType(e.target.value)} required 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          <datalist id="measure-types">
            {measureTypeOptions.map(opt => <option key={opt} value={opt} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="triggerOffsetDays" className="block text-sm font-medium text-gray-700">Trigger Offset (Days from Hatch) <span className="text-red-500">*</span></label>
          <input type="number" name="triggerOffsetDays" id="triggerOffsetDays" value={triggerOffsetDays} 
            onChange={(e) => setTriggerOffsetDays(e.target.value === '' ? '' : Number(e.target.value))} required min="0"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div className="flex items-center">
          <input type="checkbox" name="isRecurring" id="isRecurring" checked={isRecurring === 1} 
            onChange={(e) => setIsRecurring(e.target.checked ? 1 : 0)}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
          <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-900">Is Recurring?</label>
        </div>
        {isRecurring === 1 && (
          <div>
            <label htmlFor="recurrenceIntervalDays" className="block text-sm font-medium text-gray-700">Recurrence Interval (Days) <span className="text-red-500">*</span></label>
            <input type="number" name="recurrenceIntervalDays" id="recurrenceIntervalDays" value={recurrenceIntervalDays} 
              onChange={(e) => setRecurrenceIntervalDays(e.target.value === '' ? '' : Number(e.target.value))} required min="1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
        )}
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
            {isProcessing ? 'Saving...' : (initialData ? 'Update Schedule' : 'Add Schedule')}
          </button>
        </div>
      </form>
    </div>
  );
}