'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { db, Reminder, PlantingLog } from '@/lib/db'; // Removed unused Crop, SeedBatch

interface ReminderFormProps {
  existingReminder?: Reminder | null;
  onClose: (refresh?: boolean) => void;
}

const commonActivityTypes = [
  "Watering", "Fertilizing", "Pest Control", "Disease Control",
  "Weeding", "Pruning", "Thinning", "Scouting", "Soil Preparation",
  "Mulching", "Trellising", "Harvest Check", "Equipment Maintenance", "Custom Task"
];

const ReminderForm: React.FC<ReminderFormProps> = ({ existingReminder, onClose }) => {
  const [plantingLogId, setPlantingLogId] = useState<string | undefined>(existingReminder?.planting_log_id || undefined);
  const [activityType, setActivityType] = useState<string>(existingReminder?.activity_type || '');
  const [customActivityType, setCustomActivityType] = useState<string>('');
  const [reminderDate, setReminderDate] = useState<string>(
    existingReminder?.reminder_date 
      ? new Date(existingReminder.reminder_date).toISOString().substring(0, 16) // Format for datetime-local
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 16) // Default to tomorrow
  );
  const [notes, setNotes] = useState<string>(existingReminder?.notes || '');
  
  const [availablePlantingLogs, setAvailablePlantingLogs] = useState<(PlantingLog & { displayLabel?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomActivity = activityType === 'Custom Task';

  useEffect(() => {
    const fetchPlantingLogs = async () => {
      try {
        const pLogs = await db.plantingLogs.where('is_deleted').notEqual(1).toArray();
        const seedBatches = await db.seedBatches.where('is_deleted').notEqual(1).toArray();
        const crops = await db.crops.where('is_deleted').notEqual(1).toArray();
        
        const enrichedPlantingLogs = pLogs.map(pl => {
          let cropName = 'N/A';
          if (pl.seed_batch_id) {
            const sBatch = seedBatches.find(sb => sb.id === pl.seed_batch_id);
            if (sBatch) {
              const crop = crops.find(c => c.id === sBatch.crop_id);
              cropName = crop?.name || 'Crop?';
            }
          } else if (pl.seedling_production_log_id) {
            // This part requires an async lookup if we want full detail from seedling log's crop
            // For simplicity in form dropdown, we might omit full crop name from seedling log here
            // or accept a small delay if essential. For now, let's mark as 'Seedling Sourced'.
            // A better approach would be to have crop_id directly on PlantingLog if possible.
            cropName = 'Seedling Sourced'; 
          }
          return {
            ...pl,
            displayLabel: `${new Date(pl.planting_date).toLocaleDateString()} - ${cropName} (${pl.plot_affected || pl.location_description || 'N/A'})`
          };
        });
        setAvailablePlantingLogs(enrichedPlantingLogs.sort((a,b) => new Date(b.planting_date).getTime() - new Date(a.planting_date).getTime()));
      } catch (err) {
        console.error("Failed to fetch planting logs for reminder form:", err);
        setError("Could not load planting logs.");
      }
    };
    fetchPlantingLogs();

    if (existingReminder && !commonActivityTypes.includes(existingReminder.activity_type)) {
        setActivityType('Custom Task');
        setCustomActivityType(existingReminder.activity_type);
    }

  }, [existingReminder]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const finalActivityType = isCustomActivity ? customActivityType.trim() : activityType;

    if (!finalActivityType || !reminderDate) {
      setError("Activity Type and Reminder Date are required.");
      setIsLoading(false);
      return;
    }

    const reminderData: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | '_synced' | '_last_modified' | 'is_deleted' | 'deleted_at' | 'is_completed' | 'completed_at'> = {
      planting_log_id: plantingLogId || undefined,
      activity_type: finalActivityType,
      reminder_date: new Date(reminderDate).toISOString(), // Ensure ISO format
      notes: notes.trim() || undefined,
    };

    try {
      if (existingReminder?.id) {
        const updatedReminder = {
            ...existingReminder,
            ...reminderData,
            updated_at: new Date().toISOString(),
            _synced: 0,
            _last_modified: Date.now()
        };
        await db.reminders.put(updatedReminder);
      } else {
        const newReminder: Reminder = {
          ...reminderData,
          id: crypto.randomUUID(),
          is_completed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
        };
        await db.reminders.add(newReminder);
      }
      onClose(true); // Refresh list
    } catch (err) {
      console.error("Failed to save reminder:", err);
      setError("Failed to save reminder. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="plantingLogId" className="block text-sm font-medium text-gray-700">Link to Planting Log (Optional)</label>
        <select
          id="plantingLogId"
          name="plantingLogId"
          value={plantingLogId || ''}
          onChange={(e) => setPlantingLogId(e.target.value || undefined)}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        >
          <option value="">None (General Task)</option>
          {availablePlantingLogs.map(pl => (
            <option key={pl.id} value={pl.id}>
              {pl.displayLabel}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="activityType" className="block text-sm font-medium text-gray-700">Activity Type</label>
        <select
          id="activityType"
          name="activityType"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        >
          <option value="">Select or type activity</option>
          {commonActivityTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {isCustomActivity && (
        <div>
          <label htmlFor="customActivityType" className="block text-sm font-medium text-gray-700">Custom Activity Name</label>
          <input
            type="text"
            id="customActivityType"
            name="customActivityType"
            value={customActivityType}
            onChange={(e) => setCustomActivityType(e.target.value)}
            required={isCustomActivity}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="Enter custom activity"
          />
        </div>
      )}

      <div>
        <label htmlFor="reminderDate" className="block text-sm font-medium text-gray-700">Reminder Date & Time</label>
        <input
          type="datetime-local"
          id="reminderDate"
          name="reminderDate"
          value={reminderDate}
          onChange={(e) => setReminderDate(e.target.value)}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="pt-5">
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : (existingReminder ? 'Update Reminder' : 'Add Reminder')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReminderForm;