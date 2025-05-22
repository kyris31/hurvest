'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Reminder } from '@/lib/db'; // Removed unused PlantingLog, Crop, SeedBatch
// import Layout from '@/components/Layout'; // Layout is handled by RootLayout
import ReminderForm from '@/components/ReminderForm'; // Import the form
import { PlusCircleIcon, CheckCircleIcon, XCircleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

interface EnrichedReminder extends Reminder {
  plantingLogInfo?: string;
  cropName?: string;
  flockName?: string; // For poultry flock related reminders
  scheduleName?: string; // For reminders generated from a schedule
}

export default function RemindersPage() {
  const [upcomingReminders, setUpcomingReminders] = useState<EnrichedReminder[]>([]);
  const [completedReminders, setCompletedReminders] = useState<EnrichedReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const fetchReminders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allReminders = await db.reminders.where('is_deleted').notEqual(1).sortBy('reminder_date');
      const plantingLogs = await db.plantingLogs.filter(pl => pl.is_deleted !== 1).toArray();
      const seedBatches = await db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
      const crops = await db.crops.filter(c => c.is_deleted !== 1).toArray();
      const flocks = await db.flocks.filter(f => f.is_deleted !== 1).toArray(); // Fetch flocks
      const schedules = await db.preventive_measure_schedules.filter(s => s.is_deleted !== 1).toArray(); // Fetch schedules

      const enrichedReminders: EnrichedReminder[] = [];
      for (const reminder of allReminders) {
        let plantingLogInfo = 'General Task';
        let cropName = 'N/A';
        let flockName: string | undefined = undefined;
        let scheduleName: string | undefined = undefined;

        if (reminder.planting_log_id) {
          const pLog = plantingLogs.find(pl => pl.id === reminder.planting_log_id);
          if (pLog) {
            let cName = 'Unknown Crop';
            if (pLog.seed_batch_id) {
              const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
              if (sBatch) {
                const crop = crops.find(c => c.id === sBatch.crop_id);
                cName = crop?.name || 'Crop Name Missing';
              }
            } else if (pLog.seedling_production_log_id) {
                const seedlingLog = await db.seedlingProductionLogs.get(pLog.seedling_production_log_id);
                if (seedlingLog) {
                    const crop = crops.find(c => c.id === seedlingLog.crop_id);
                    cName = crop?.name || 'Crop (from seedling) Missing';
                }
            }
            cropName = cName;
            plantingLogInfo = `${cName} (${pLog.plot_affected || pLog.location_description || 'N/A'}) - Planted: ${new Date(pLog.planting_date).toLocaleDateString()}`;
          }
        }
        if (reminder.flock_id) {
          const flock = flocks.find(f => f.id === reminder.flock_id);
          flockName = flock?.name || 'Unknown Flock';
        }
        if (reminder.preventive_measure_schedule_id) {
          const schedule = schedules.find(s => s.id === reminder.preventive_measure_schedule_id);
          scheduleName = schedule?.name || 'Unknown Schedule';
        }
        enrichedReminders.push({ ...reminder, plantingLogInfo, cropName, flockName, scheduleName });
      }

      const upcoming = enrichedReminders.filter(r => r.is_completed === 0).sort((a,b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime());
      const completed = enrichedReminders.filter(r => r.is_completed === 1).sort((a,b) => new Date(b.completed_at || b.reminder_date).getTime() - new Date(a.completed_at || a.reminder_date).getTime());
      
      setUpcomingReminders(upcoming);
      setCompletedReminders(completed);

    } catch (err) {
      console.error("Failed to fetch reminders:", err);
      setError("Failed to load reminders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleAddReminder = () => {
    setEditingReminder(null);
    setShowFormModal(true);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowFormModal(true);
  };

  const handleToggleComplete = async (reminder: Reminder) => {
    try {
      const now = new Date().toISOString();
      const newCompletedStatus = reminder.is_completed ? 0 : 1;
      
      await db.reminders.update(reminder.id, {
        is_completed: newCompletedStatus,
        completed_at: newCompletedStatus === 1 ? now : undefined,
        updated_at: now,
        _synced: 0,
        _last_modified: Date.now()
      });

      // If just marked as complete, check for recurrence
      if (newCompletedStatus === 1 && reminder.preventive_measure_schedule_id) {
        const schedule = await db.preventive_measure_schedules.get(reminder.preventive_measure_schedule_id);
        if (schedule && schedule.is_recurring === 1 && schedule.recurrence_interval_days && schedule.recurrence_interval_days > 0) {
          const currentReminderDate = new Date(reminder.reminder_date); // Use original due date as base for next recurrence
          const nextReminderDate = new Date(currentReminderDate);
          nextReminderDate.setDate(currentReminderDate.getDate() + schedule.recurrence_interval_days);

          const nextReminderId = crypto.randomUUID();
          const nextReminderTimestamp = Date.now();
          const nextReminderToCreate: Reminder = {
            id: nextReminderId,
            planting_log_id: reminder.planting_log_id, // Carry over if it was planting related
            flock_id: reminder.flock_id, // Carry over flock_id
            preventive_measure_schedule_id: reminder.preventive_measure_schedule_id, // Link to same schedule
            activity_type: schedule.measure_type, // Use type from schedule
            reminder_date: nextReminderDate.toISOString().split('T')[0],
            notes: `Recurring: ${schedule.name}. ${schedule.description || ''}`.trim(),
            is_completed: 0,
            completed_at: undefined,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: nextReminderTimestamp,
            is_deleted: 0,
          };
          await db.reminders.add(nextReminderToCreate);
          console.log(`Generated next recurring reminder: ${nextReminderToCreate.activity_type} on ${nextReminderToCreate.reminder_date} from schedule ${schedule.id}`);
        }
      }
      fetchReminders(); // This will now include the newly generated reminder if any
    } catch (err) {
      console.error("Failed to toggle reminder complete status:", err);
      alert("Failed to update reminder. Please try again.");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (confirm('Are you sure you want to delete this reminder?')) {
      try {
        await db.reminders.update(id, { 
          is_deleted: 1, 
          deleted_at: new Date().toISOString(),
          _synced: 0,
          _last_modified: Date.now()
        });
        fetchReminders();
      } catch (err) {
        console.error("Failed to delete reminder:", err);
        alert("Failed to delete reminder. Please try again.");
      }
    }
  };
  
  const handleFormClose = (refresh?: boolean) => {
    setShowFormModal(false);
    setEditingReminder(null);
    if (refresh) {
      fetchReminders();
    }
  };

  const renderReminderCard = (reminder: EnrichedReminder) => {
    const isOverdue = !reminder.is_completed && new Date(reminder.reminder_date) < new Date();
    let cardBgColor = 'bg-yellow-50';
    let borderColor = 'border-yellow-200';
    let titleColor = 'text-yellow-700';

    if (reminder.is_completed) {
      cardBgColor = 'bg-green-50';
      borderColor = 'border-green-200';
      titleColor = 'text-green-700';
    } else if (isOverdue) {
      cardBgColor = 'bg-red-50'; // Overdue color
      borderColor = 'border-red-300';
      titleColor = 'text-red-700';
    }

    return (
    <div key={reminder.id} className={`p-4 rounded-lg shadow ${cardBgColor} border ${borderColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`text-md font-semibold ${titleColor}`}>
            {reminder.activity_type} {isOverdue && !reminder.is_completed && <span className="text-xs font-normal">(Overdue)</span>}
          </h3>
          <p className={`text-sm ${isOverdue && !reminder.is_completed ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            Due: {new Date(reminder.reminder_date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {reminder.planting_log_id && (
            <p className="text-xs text-gray-500 mt-1">Planting Target: {reminder.plantingLogInfo}</p>
          )}
          {reminder.flockName && (
            <p className="text-xs text-gray-500 mt-1">Flock: {reminder.flockName}</p>
          )}
          {reminder.scheduleName && (
            <p className="text-xs text-gray-500 mt-1">From Schedule: {reminder.scheduleName}</p>
          )}
          {reminder.notes && <p className="text-sm text-gray-700 mt-2">Notes: {reminder.notes}</p>}
          {reminder.is_completed && reminder.completed_at && (
            <p className="text-xs text-green-600 mt-1">Completed: {new Date(reminder.completed_at).toLocaleString()}</p>
          )}
        </div>
        <div className="flex flex-col items-end space-y-2">
           <button
            onClick={() => handleToggleComplete(reminder)}
            title={reminder.is_completed ? "Mark as Incomplete" : "Mark as Complete"}
            className={`p-1.5 rounded-full ${reminder.is_completed ? 'hover:bg-yellow-100' : 'hover:bg-green-100'}`}
          >
            {reminder.is_completed ? <XCircleIcon className="h-6 w-6 text-yellow-500" /> : <CheckCircleIcon className="h-6 w-6 text-green-500" />}
          </button>
           <button 
            onClick={() => handleEditReminder(reminder)} 
            title="Edit Reminder"
            className="p-1.5 rounded-full hover:bg-gray-100"
            disabled={reminder.is_completed === 1} // Disable edit if completed
            >
            <PencilSquareIcon className={`h-5 w-5 ${reminder.is_completed ? 'text-gray-400' : 'text-blue-500'}`} />
          </button>
          <button 
            onClick={() => handleDeleteReminder(reminder.id)} 
            title="Delete Reminder"
            className="p-1.5 rounded-full hover:bg-gray-100"
            >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}; // Ensure renderReminderCard is properly closed

  return (
    // <Layout> // Removed redundant Layout wrapper
      <div className="p-4 md:p-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Reminders</h1>
            <button
              onClick={handleAddReminder}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <PlusCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              Add New Reminder
            </button>
          </div>
        </header>

        {isLoading && <p>Loading reminders...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {/* Form Modal Placeholder */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 transition-opacity">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    {/* Content is now handled by ReminderForm, which includes its own padding and close/submit buttons */}
                    <ReminderForm existingReminder={editingReminder} onClose={handleFormClose} />
                </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Upcoming & Pending ({upcomingReminders.length})</h2>
            {upcomingReminders.length > 0 ? (
              <div className="space-y-4">
                {upcomingReminders.map(renderReminderCard)}
              </div>
            ) : (
              !isLoading && <p className="text-gray-500">No upcoming reminders.</p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-8 border-t pt-6">Completed ({completedReminders.length})</h2>
            {completedReminders.length > 0 ? (
              <div className="space-y-4">
                {completedReminders.map(renderReminderCard)}
              </div>
            ) : (
             !isLoading && <p className="text-gray-500">No completed reminders yet.</p>
            )}
          </div>
        </div>
      </div>
    // </Layout>
  );
}