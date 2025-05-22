import { db } from '@/lib/db';
import type { Flock, PreventiveMeasureSchedule, Reminder } from '@/lib/db';

/**
 * Generates initial preventive reminders for a flock based on active schedules.
 * This function does NOT handle recurring reminders beyond the first instance.
 * @param flockId The ID of the flock for which to generate reminders.
 */
export async function generateInitialPreventiveReminders(flockId: string): Promise<void> {
  const flock = await db.flocks.get(flockId);
  if (!flock || !flock.hatch_date || flock.is_deleted === 1) {
    console.log(`Cannot generate reminders for flock ${flockId}: No flock, no hatch date, or flock is deleted.`);
    return;
  }

  if (!flock.species) {
    console.log(`Flock ${flockId} does not have a species defined. Cannot accurately match schedules. No reminders generated.`);
    return;
  }
  const flockSpecies = flock.species;

  const schedules = await db.preventive_measure_schedules
    .filter(schedule =>
      schedule.is_deleted !== 1 &&
      (!schedule.target_species || schedule.target_species === 'all_poultry' || schedule.target_species === flockSpecies)
    )
    .toArray();

  if (schedules.length === 0) {
    console.log(`No active preventive measure schedules found matching species '${flockSpecies}', 'all_poultry', or non-specific. No reminders generated for flock ${flockId}.`);
    return;
  }

  const hatchDate = new Date(flock.hatch_date);
  const remindersToAdd: Omit<Reminder, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>[] = [];

  for (const schedule of schedules) {
    // Species filtering is now done in the query above.
    // The loop will only iterate over relevant schedules.

    const reminderDate = new Date(hatchDate);
    reminderDate.setDate(hatchDate.getDate() + schedule.trigger_offset_days);

    const newReminder: Omit<Reminder, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> = {
      flock_id: flock.id,
      planting_log_id: undefined,
      preventive_measure_schedule_id: schedule.id, // Link to the schedule
      activity_type: schedule.measure_type,
      reminder_date: reminderDate.toISOString().split('T')[0],
      notes: `Preventive: ${schedule.name}. ${schedule.description || ''}`.trim(),
      is_completed: 0,
      completed_at: undefined,
    };
    remindersToAdd.push(newReminder);
  }

  if (remindersToAdd.length > 0) {
    try {
      await db.transaction('rw', db.reminders, async () => {
        for (const reminderData of remindersToAdd) {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const currentTimestamp = Date.now();
          const reminderToAdd: Reminder = {
            ...reminderData,
            id,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
          };
          // Check if a similar reminder already exists (optional, to prevent duplicates if run multiple times)
          // This check could be more sophisticated (e.g., same flock, type, and date within a small window)
          const existing = await db.reminders
            .where({
              flock_id: reminderToAdd.flock_id,
              activity_type: reminderToAdd.activity_type,
              reminder_date: reminderToAdd.reminder_date,
              is_deleted: 0
            }).first();
          
          if (!existing) {
            await db.reminders.add(reminderToAdd);
            console.log(`Generated reminder for flock ${flock.id}: ${reminderToAdd.activity_type} on ${reminderToAdd.reminder_date}`);
          } else {
            console.log(`Skipped duplicate reminder for flock ${flock.id}: ${reminderToAdd.activity_type} on ${reminderToAdd.reminder_date}`);
          }
        }
      });
      // Consider requesting push changes for reminders here if needed immediately
      // await requestPushChanges(); 
    } catch (error) {
      console.error("Error adding generated reminders to DB:", error);
    }
  } else {
    console.log(`No new reminders generated for flock ${flockId} based on current schedules.`);
  }
}