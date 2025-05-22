'use client';

import React, { useState, useEffect, useCallback } from 'react';
// import { db } from '@/lib/db'; // No longer import db directly
import type { PreventiveMeasureSchedule } from '@/lib/db';
import { useDbContext } from '@/contexts/DbContext';
import PreventiveMeasureScheduleForm from '@/components/Settings/PreventiveMeasureScheduleForm';
import { requestPushChanges } from '@/lib/sync';

export default function PoultrySchedulesPage() {
  const [schedules, setSchedules] = useState<PreventiveMeasureSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Default to true until DB readiness is checked
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PreventiveMeasureSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { isDbReady, dbInstance } = useDbContext(); // Consume dbInstance as well

  const fetchData = useCallback(async () => {
    if (!isDbReady || !dbInstance) {
      setError("Waiting for database to initialize...");
      // console.log("PoultrySchedulesPage: fetchData called, but isDbReady is false or dbInstance is null. isDbReady:", isDbReady, "dbInstance:", !!dbInstance);
      setIsLoading(true);
      return;
    }
    console.log("PoultrySchedulesPage: fetchData called. isDbReady:", isDbReady, "dbInstance keys:", Object.keys(dbInstance));
    
    setIsLoading(true);
    setError(null);
    try {
      if (!dbInstance.preventive_measure_schedules) { // Use dbInstance
        console.error("PoultrySchedulesPage: dbInstance.preventive_measure_schedules table is undefined even though DB is ready.");
        setError("Database table for schedules is not available. Please try refreshing.");
        setIsLoading(false);
        return;
      }

      const allSchedules = await dbInstance.preventive_measure_schedules // Use dbInstance
        .where('is_deleted')
        .notEqual(1)
        .sortBy('name');
      setSchedules(allSchedules);
    } catch (err) {
      console.error("Failed to fetch preventive measure schedules:", err);
      setError("Failed to load schedules. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isDbReady, dbInstance]); // Add dbInstance as a dependency

  useEffect(() => {
    // console.log("PoultrySchedulesPage: isDbReady status:", isDbReady); // For debugging
    if (isDbReady) {
      fetchData();
    } else {
      // Set loading true initially, and let fetchData handle it if DB not ready
      // This ensures "Loading schedules..." is shown until DB is ready and fetch is attempted.
      setIsLoading(true); 
      setError("Initializing database..."); // More informative initial message
    }
  }, [isDbReady, fetchData]);

  const handleEdit = (schedule: PreventiveMeasureSchedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this schedule? This will also delete any future, non-completed reminders generated from it.")) {
      setIsDeleting(id);
      setError(null);
      try {
        if (!dbInstance) {
          setError("Database not available for delete operation.");
          setIsDeleting(null);
          return;
        }

        await dbInstance.transaction('rw', dbInstance.preventive_measure_schedules, dbInstance.reminders, async () => {
          const now = new Date().toISOString();
          const currentTimestamp = Date.now();

          // 1. Mark the schedule for deletion
          await dbInstance.preventive_measure_schedules.update(id, {
            is_deleted: 1,
            deleted_at: now,
            _synced: 0,
            _last_modified: currentTimestamp
          });
          console.log(`Preventive Measure Schedule ${id} marked for deletion.`);

          // 2. Find and mark associated future, non-completed reminders for deletion
          const associatedReminders = await dbInstance.reminders
            .where('preventive_measure_schedule_id').equals(id)
            .and(reminder => reminder.is_completed === 0 && reminder.is_deleted !== 1)
            .toArray();

          if (associatedReminders.length > 0) {
            console.log(`Found ${associatedReminders.length} associated future reminders to delete for schedule ${id}.`);
            for (const reminder of associatedReminders) {
              await dbInstance.reminders.update(reminder.id, {
                is_deleted: 1,
                deleted_at: now,
                _synced: 0,
                _last_modified: currentTimestamp
              });
            }
          }
        });
        
        await fetchData(); // Refresh the list of schedules
        await requestPushChanges(); // Sync changes
        
      } catch (err) {
        console.error("Failed to delete schedule and associated reminders:", err);
        setError("Failed to delete schedule and/or its reminders.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setError(null);
    if (isDbReady) fetchData(); // Refresh data only if DB is ready
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Preventive Measure Schedules (Poultry)</h1>
          <button
            onClick={() => { setEditingSchedule(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
            disabled={!isDbReady} // Disable if DB not ready
          >
            Add New Schedule
          </button>
        </div>
      </header>

      {showForm && isDbReady && ( // Only show form if DB is ready
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 my-4">
          <PreventiveMeasureScheduleForm
            initialData={editingSchedule}
            onSubmitSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </div>
      )}

      <div className="mt-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading schedules...</p>}
        {!isDbReady && !isLoading && <p className="text-center text-gray-500">Waiting for database initialization...</p>}
        
        {isDbReady && !isLoading && !showForm && schedules.length === 0 && !error && (
          <p className="text-center text-gray-500">No preventive measure schedules found. Click "Add New Schedule" to create one.</p>
        )}
        {isDbReady && !isLoading && !showForm && schedules.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measure Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offset (Days from Hatch)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recurring</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interval (Days)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className={`${isDeleting === schedule.id ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{schedule.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.measure_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.trigger_offset_days}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.is_recurring === 1 ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{schedule.is_recurring === 1 ? schedule.recurrence_interval_days || 'N/A' : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-300"
                        disabled={isDeleting === schedule.id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="text-red-600 hover:text-red-900 disabled:text-gray-300"
                        disabled={isDeleting === schedule.id}
                      >
                        {isDeleting === schedule.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}