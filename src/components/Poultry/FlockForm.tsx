'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import type { Flock } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';
import { generateInitialPreventiveReminders } from '@/lib/poultryUtils'; // Import the new utility

interface FlockFormProps {
  initialData?: Flock | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  isSubmitting?: boolean; // Optional, if parent wants to control/show submitting state
}

export default function FlockForm({ initialData, onSubmitSuccess, onCancel }: FlockFormProps) {
  const [name, setName] = useState('');
  const [flockType, setFlockType] = useState<'egg_layer' | 'broiler'>('egg_layer');
  const [species, setSpecies] = useState<'chicken' | 'turkey' | 'duck' | 'quail' | 'other'>('chicken'); // New state for species
  const [breed, setBreed] = useState('');
  const [hatchDate, setHatchDate] = useState('');
  const [initialBirdCount, setInitialBirdCount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setFlockType(initialData.flock_type);
      setSpecies(initialData.species || 'chicken'); // Set species from initialData or default
      setBreed(initialData.breed || '');
      setHatchDate(initialData.hatch_date ? initialData.hatch_date.split('T')[0] : '');
      setInitialBirdCount(initialData.initial_bird_count ?? '');
      setNotes(initialData.notes || '');
    } else {
      // Reset form for new entry
      setName('');
      setFlockType('egg_layer');
      setSpecies('chicken'); // Default species for new flock
      setBreed('');
      setHatchDate('');
      setInitialBirdCount('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsProcessing(true);

    if (!name.trim()) {
      setError("Flock name is required.");
      setIsProcessing(false);
      return;
    }
    if (initialBirdCount !== '' && isNaN(Number(initialBirdCount))) {
        setError("Initial bird count must be a number.");
        setIsProcessing(false);
        return;
    }

    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if (initialData?.id) { // Editing existing flock
        const oldHatchDate = initialData.hatch_date;
        const oldSpecies = initialData.species;

        const updates: Partial<Flock> = {
          name,
          flock_type: flockType,
          species: species,
          breed: breed || undefined,
          hatch_date: hatchDate || undefined,
          initial_bird_count: initialBirdCount === '' ? undefined : Number(initialBirdCount),
          notes: notes || undefined,
          updated_at: now,
        };
        
        await db.transaction('rw', db.flocks, db.reminders, async () => {
          await db.flocks.update(initialData.id!, updates); // Use non-null assertion for id
          await db.markForSync('flocks', initialData.id!, updates); // Use non-null assertion for id
          console.log(`Flock ${initialData.id} updated locally and marked for sync.`);

          const newHatchDate = updates.hatch_date;
          const newSpecies = updates.species;
          let regenerateReminders = false;

          if (newHatchDate && newHatchDate !== oldHatchDate) {
            regenerateReminders = true;
            console.log(`Flock ${initialData.id} hatch date changed from ${oldHatchDate} to ${newHatchDate}.`);
          }
          if (newSpecies && newSpecies !== oldSpecies) {
            regenerateReminders = true;
            console.log(`Flock ${initialData.id} species changed from ${oldSpecies} to ${newSpecies}.`);
          }

          if (regenerateReminders && newHatchDate) { // Ensure new hatch date is valid for regeneration
            console.log(`Regenerating reminders for flock ${initialData.id}.`);
            // 1. Soft-delete existing future, non-completed, schedule-based reminders for this flock
            const existingScheduledReminders = await db.reminders
              .where('flock_id').equals(initialData.id!)
              .and(r => r.is_completed === 0 && r.is_deleted !== 1 && !!r.preventive_measure_schedule_id)
              .toArray();
            
            if (existingScheduledReminders.length > 0) {
              console.log(`Found ${existingScheduledReminders.length} existing scheduled reminders to soft-delete for flock ${initialData.id}.`);
              const reminderIdsToDelete = existingScheduledReminders.map(r => r.id);
              await db.reminders.bulkUpdate(reminderIdsToDelete.map(id => ({
                key: id,
                changes: {
                  is_deleted: 1,
                  deleted_at: now,
                  _synced: 0,
                  _last_modified: currentTimestamp
                }
              })));
            }
            // 2. Generate new set of initial reminders
            await generateInitialPreventiveReminders(initialData.id!);
          }
        });

      } else { // Adding new flock
        const newFlockData: Omit<Flock, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> & { current_bird_count?: number } = {
          name,
          flock_type: flockType,
          species: species, // Add species for new flock
          breed: breed || undefined,
          hatch_date: hatchDate || undefined,
          initial_bird_count: initialBirdCount === '' ? undefined : Number(initialBirdCount),
          current_bird_count: initialBirdCount === '' ? undefined : Number(initialBirdCount),
          notes: notes || undefined,
        };
        
        const id = crypto.randomUUID();
        const flockToAdd: Flock = {
            ...newFlockData,
            id,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
        };
        await db.flocks.add(flockToAdd);
        console.log(`New flock ${id} added locally and marked for sync.`);
        
        // Generate initial reminders for the new flock if hatch_date is set
        if (flockToAdd.hatch_date) {
          await generateInitialPreventiveReminders(flockToAdd.id);
        }
      }
      await requestPushChanges(); // Attempt to push changes immediately
      onSubmitSuccess();
    } catch (err) {
      console.error("Failed to save flock:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="my-6 p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        {initialData ? 'Edit Flock' : 'Add New Flock'}
      </h2>
      {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Flock Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="flockType" className="block text-sm font-medium text-gray-700">
            Flock Type
          </label>
          <select
            name="flockType"
            id="flockType"
            value={flockType}
            onChange={(e) => setFlockType(e.target.value as 'egg_layer' | 'broiler')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="egg_layer">Egg Layer</option>
            <option value="broiler">Broiler (Meat)</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="species" className="block text-sm font-medium text-gray-700">
            Species
          </label>
          <select
            name="species"
            id="species"
            value={species}
            onChange={(e) => setSpecies(e.target.value as 'chicken' | 'turkey' | 'duck' | 'quail' | 'other')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="chicken">Chicken</option>
            <option value="turkey">Turkey</option>
            <option value="duck">Duck</option>
            <option value="quail">Quail</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="breed" className="block text-sm font-medium text-gray-700">
            Breed
          </label>
          <input
            type="text"
            name="breed"
            id="breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="hatchDate" className="block text-sm font-medium text-gray-700">
            Hatch Date
          </label>
          <input
            type="date"
            name="hatchDate"
            id="hatchDate"
            value={hatchDate}
            onChange={(e) => setHatchDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="initialBirdCount" className="block text-sm font-medium text-gray-700">
            Initial Bird Count
          </label>
          <input
            type="number"
            name="initialBirdCount"
            id="initialBirdCount"
            value={initialBirdCount}
            onChange={(e) => setInitialBirdCount(e.target.value === '' ? '' : Number(e.target.value))}
            min="0"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            name="notes"
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            {isProcessing ? 'Saving...' : (initialData ? 'Update Flock' : 'Add Flock')}
          </button>
        </div>
      </form>
    </div>
  );
}