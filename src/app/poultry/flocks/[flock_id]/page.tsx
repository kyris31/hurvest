'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import type { Flock, FlockRecord, FeedLog, InputInventory, Reminder } from '@/lib/db'; // Added Reminder type
import FlockRecordForm from '@/components/Poultry/FlockRecordForm';
import FeedLogForm from '@/components/Poultry/FeedLogForm';
import ReminderForm from '@/components/ReminderForm';
import { requestPushChanges } from '@/lib/sync';
import { CheckCircleIcon, XCircleIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline'; // Added PencilSquareIcon

export default function FlockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const flock_id = typeof params.flock_id === 'string' ? params.flock_id : '';

  const [flock, setFlock] = useState<Flock | null>(null);
  const [allFlockRecords, setAllFlockRecords] = useState<FlockRecord[]>([]);
  const [filteredFlockRecords, setFilteredFlockRecords] = useState<FlockRecord[]>([]);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>('');

  const [feedLogs, setFeedLogs] = useState<FeedLog[]>([]);
  const [feedTypeMap, setFeedTypeMap] = useState<Map<string, string>>(new Map());
  
  const [flockReminders, setFlockReminders] = useState<Reminder[]>([]); // State for flock-specific reminders
  const [showReminderFormForFlock, setShowReminderFormForFlock] = useState(false);
  const [editingFlockReminder, setEditingFlockReminder] = useState<Reminder | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FlockRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState<string | null>(null);

  const [showFeedLogForm, setShowFeedLogForm] = useState(false);
  const [editingFeedLog, setEditingFeedLog] = useState<FeedLog | null>(null);
  const [isDeletingFeedLog, setIsDeletingFeedLog] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!flock_id) {
      setError("Flock ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      const flockData = await db.flocks.get(flock_id);

      if (!flockData || flockData.is_deleted === 1) {
        setError("Flock not found or has been deleted.");
        setFlock(null);
        setAllFlockRecords([]);
        setFilteredFlockRecords([]);
        setFeedLogs([]);
        setIsLoading(false);
        return;
      }
      setFlock(flockData);

      const [recordsData, feedsData, remindersData] = await Promise.all([
        db.flock_records.where('flock_id').equals(flock_id).and(r => r.is_deleted !== 1).reverse().sortBy('record_date'),
        db.feed_logs.where('flock_id').equals(flock_id).and(f => f.is_deleted !== 1).reverse().sortBy('feed_date'),
        db.reminders.where('flock_id').equals(flock_id).and(r => r.is_deleted !== 1).reverse().sortBy('reminder_date') // Fetch reminders
      ]);
      
      setAllFlockRecords(recordsData);
      setFlockReminders(remindersData); // Set flock reminders
      // Apply current filter to newly fetched records
      if (recordTypeFilter === '') {
        setFilteredFlockRecords(recordsData);
      } else {
        setFilteredFlockRecords(recordsData.filter(record => record.record_type === recordTypeFilter));
      }
      setFeedLogs(feedsData);

      const feedTypeIds = feedsData
        .map(log => log.feed_type_id)
        .filter((id): id is string => !!id);

      if (feedTypeIds.length > 0) {
        const uniqueFeedTypeIds = [...new Set(feedTypeIds)];
        const feedItems = await db.inputInventory.where('id').anyOf(uniqueFeedTypeIds).toArray();
        const newFeedTypeMap = new Map<string, string>();
        feedItems.forEach(item => {
          if (item.id) {
            newFeedTypeMap.set(item.id, item.name);
          }
        });
        setFeedTypeMap(newFeedTypeMap);
      } else {
        setFeedTypeMap(new Map()); // Clear map if no feed logs with types
      }

    } catch (err) {
      console.error("Failed to fetch flock details:", err);
      setError("Failed to load flock details.");
    } finally {
      setIsLoading(false);
    }
  }, [flock_id, recordTypeFilter]); // recordTypeFilter added as dependency to re-filter if it changes while data is fetched

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData itself depends on flock_id and recordTypeFilter

  // This separate effect for filtering is fine, but fetchData now also applies the filter.
  // Keeping it ensures responsiveness if only the filter changes without a full re-fetch.
  useEffect(() => {
    if (recordTypeFilter === '') {
      setFilteredFlockRecords(allFlockRecords);
    } else {
      setFilteredFlockRecords(allFlockRecords.filter(record => record.record_type === recordTypeFilter));
    }
  }, [recordTypeFilter, allFlockRecords]);

  const handleToggleFlockReminderComplete = async (reminder: Reminder) => {
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

      // If just marked as complete, check for recurrence (copied from RemindersPage)
      if (newCompletedStatus === 1 && reminder.preventive_measure_schedule_id) {
        const schedule = await db.preventive_measure_schedules.get(reminder.preventive_measure_schedule_id);
        if (schedule && schedule.is_recurring === 1 && schedule.recurrence_interval_days && schedule.recurrence_interval_days > 0) {
          const currentReminderDate = new Date(reminder.reminder_date);
          const nextReminderDate = new Date(currentReminderDate);
          nextReminderDate.setDate(currentReminderDate.getDate() + schedule.recurrence_interval_days);

          const nextReminderId = crypto.randomUUID();
          const nextReminderTimestamp = Date.now();
          const nextReminderToCreate: Reminder = {
            id: nextReminderId,
            planting_log_id: reminder.planting_log_id,
            flock_id: reminder.flock_id,
            preventive_measure_schedule_id: reminder.preventive_measure_schedule_id,
            activity_type: schedule.measure_type,
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
          console.log(`Generated next recurring reminder for flock ${flock_id}: ${nextReminderToCreate.activity_type} on ${nextReminderToCreate.reminder_date}`);
        }
      }
      fetchData(); // Re-fetch all flock data, including reminders
      await requestPushChanges();
    } catch (err) {
      console.error("Failed to toggle flock reminder complete status:", err);
      setError("Failed to update reminder status.");
    }
  };

  const handleDeleteFlockReminder = async (reminderId: string) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await db.reminders.update(reminderId, {
          is_deleted: 1,
          deleted_at: new Date().toISOString(),
          _synced: 0,
          _last_modified: Date.now()
        });
        fetchData(); // Re-fetch all flock data
        await requestPushChanges();
      } catch (err) {
        console.error("Failed to delete flock reminder:", err);
        setError("Failed to delete reminder.");
      }
    }
  };


  if (isLoading) {
    return <div className="text-center p-10">Loading flock details...</div>;
  }

  if (error && !flock) { // Only show full page error if flock couldn't be loaded at all
    return (
      <div className="text-center p-10">
        <p className="text-red-500">{error}</p>
        <Link href="/poultry/flocks" className="text-blue-500 hover:underline mt-4 inline-block">
          Back to Flocks List
        </Link>
      </div>
    );
  }

  if (!flock) {
     // This case should ideally be covered by the error state if fetchData fails to find flock
    return (
      <div className="text-center p-10">
        <p>Flock not found.</p>
        <Link href="/poultry/flocks" className="text-blue-500 hover:underline mt-4 inline-block">
          Back to Flocks List
        </Link>
      </div>
    );
  }
  
  const calculateAge = (hatchDateStr?: string): string => {
    if (!hatchDateStr) return 'N/A';
    const hatchDate = new Date(hatchDateStr);
    const today = new Date();
    let ageInWeeks = (today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
    if (ageInWeeks < 0) ageInWeeks = 0; 
    return `${Math.floor(ageInWeeks)} weeks`;
  };
  
  const availableRecordTypes: FlockRecord['record_type'][] = [
    'vaccination', 'illness', 'treatment', 'mortality', 
    'cull_sale', 'weight_check', 'egg_collection', 'egg_sale', 'other'
  ];

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <Link href="/poultry/flocks" className="text-blue-500 hover:underline mb-4 inline-block">
          &larr; Back to Flocks List
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{flock.name}</h1>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>} {/* Display non-critical errors here */}
        <p className="text-sm text-gray-600">
          Type: {flock.flock_type === 'egg_layer' ? 'Egg Layer' : 'Broiler'} | Breed: {flock.breed || 'N/A'}
        </p>
        <p className="text-sm text-gray-600">
          Hatch Date: {flock.hatch_date ? new Date(flock.hatch_date).toLocaleDateString() : 'N/A'} ({calculateAge(flock.hatch_date)})
        </p>
        <p className="text-sm text-gray-600">
          Initial Birds: {flock.initial_bird_count ?? 'N/A'} | Current Birds: {flock.current_bird_count ?? flock.initial_bird_count ?? 'N/A'}
        </p>
        {flock.notes && <p className="text-sm text-gray-500 mt-1">Notes: {flock.notes}</p>}
      </header>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-2xl font-semibold text-gray-800">Flock Records</h2>
          <div className="flex items-center space-x-3">
            <select 
              value={recordTypeFilter} 
              onChange={(e) => setRecordTypeFilter(e.target.value)}
              className="text-sm p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Record Types</option>
              {availableRecordTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            <button
              onClick={() => { setEditingRecord(null); setShowRecordForm(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-sm shadow-sm"
            >
              Add Record
            </button>
          </div>
        </div>

        {showRecordForm && (
          <FlockRecordForm
            flockId={flock.id}
            initialData={editingRecord}
            onSubmitSuccess={() => { setShowRecordForm(false); setEditingRecord(null); fetchData(); }}
            onCancel={() => { setShowRecordForm(false); setEditingRecord(null); }}
          />
        )}

        {filteredFlockRecords.length === 0 && !showRecordForm ? (
          <p className="text-gray-500">{recordTypeFilter ? `No '${recordTypeFilter.replace('_', ' ')}' records found.` : 'No records yet for this flock.'}</p>
        ) : (
          !showRecordForm && <ul className="space-y-2">
            {filteredFlockRecords.map(record => (
              <li key={record.id} className={`p-3 bg-gray-50 rounded shadow-sm ${isDeletingRecord === record.id ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{new Date(record.record_date).toLocaleDateString()} - {record.record_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    <p className="text-sm text-gray-700">Details: {record.details}</p>
                    {record.quantity !== undefined && <p className="text-sm text-gray-700">Quantity: {record.quantity}</p>}
                    {record.weight_kg_total !== undefined && <p className="text-sm text-gray-700">Total Weight: {record.weight_kg_total} kg</p>}
                    {record.cost !== undefined && <p className="text-sm text-gray-700">Cost: €{record.cost.toFixed(2)}</p>}
                    {record.revenue !== undefined && <p className="text-sm text-gray-700">Revenue: €{record.revenue.toFixed(2)}</p>}
                    {record.outcome && <p className="text-sm text-gray-700">Outcome: {record.outcome}</p>}
                    {record.notes && <p className="text-sm text-gray-600">Notes: {record.notes}</p>}
                  </div>
                  <div className="space-x-2 flex-shrink-0 mt-1">
                    <button 
                      onClick={() => { setEditingRecord(record); setShowRecordForm(true);}}
                      className="text-xs text-indigo-600 hover:text-indigo-900 disabled:text-gray-300"
                      disabled={isDeletingRecord === record.id}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to delete this flock record?")) {
                          setIsDeletingRecord(record.id);
                          try {
                            await db.markForSync('flock_records', record.id, {}, true);
                            await fetchData(); // Re-fetches and applies filter
                            await requestPushChanges();
                          } catch (err) { console.error("Delete flock record failed", err); setError("Failed to delete record.");}
                          finally { setIsDeletingRecord(null); }
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-900 disabled:text-gray-300"
                      disabled={isDeletingRecord === record.id}
                    >
                      {isDeletingRecord === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-2xl font-semibold text-gray-800">Feed Logs</h2>
          <button
            onClick={() => { setEditingFeedLog(null); setShowFeedLogForm(true); }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-sm shadow-sm"
          >
            Add Feed Log
          </button>
        </div>

        {showFeedLogForm && (
          <FeedLogForm
            flockId={flock.id}
            initialData={editingFeedLog}
            onSubmitSuccess={() => { setShowFeedLogForm(false); setEditingFeedLog(null); fetchData(); }}
            onCancel={() => { setShowFeedLogForm(false); setEditingFeedLog(null); }}
          />
        )}

        {feedLogs.length === 0 && !showFeedLogForm ? (
          <p className="text-gray-500">No feed logs yet for this flock.</p>
        ) : (
          !showFeedLogForm && <ul className="space-y-2">
            {feedLogs.map(log => (
              <li key={log.id} className={`p-3 bg-gray-50 rounded shadow-sm ${isDeletingFeedLog === log.id ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Date: {new Date(log.feed_date).toLocaleDateString()}</p>
                    {log.feed_type_id && (
                      <p className="text-sm text-gray-700">
                        Feed Type: {feedTypeMap.get(log.feed_type_id) || log.feed_type_id}
                      </p>
                    )}
                    {log.quantity_fed_kg !== undefined && <p className="text-sm text-gray-700">Quantity Fed: {log.quantity_fed_kg} kg</p>}
                    {log.feed_cost !== undefined && <p className="text-sm text-gray-700">Feed Cost: €{log.feed_cost.toFixed(2)}</p>}
                    {log.notes && <p className="text-sm text-gray-600">Notes: {log.notes}</p>}
                  </div>
                  <div className="space-x-2 flex-shrink-0 mt-1">
                    <button
                      onClick={() => { setEditingFeedLog(log); setShowFeedLogForm(true); }}
                      className="text-xs text-indigo-600 hover:text-indigo-900 disabled:text-gray-300"
                      disabled={isDeletingFeedLog === log.id}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to delete this feed log?")) {
                          setIsDeletingFeedLog(log.id);
                          try {
                            // Consider inventory adjustment if deleting a feed log (add back to inventory)
                            // For simplicity, this is not implemented here.
                            await db.markForSync('feed_logs', log.id, {}, true);
                            await fetchData();
                            await requestPushChanges();
                          } catch (err) { console.error("Delete feed log failed", err); setError("Failed to delete feed log.");}
                          finally { setIsDeletingFeedLog(null); }
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-900 disabled:text-gray-300"
                      disabled={isDeletingFeedLog === log.id}
                    >
                      {isDeletingFeedLog === log.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for Flock-Specific Reminders */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-2xl font-semibold text-gray-800">Flock Reminders</h2>
          <button
            onClick={() => { setEditingFlockReminder(null); setShowReminderFormForFlock(true); }}
            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded text-sm shadow-sm"
          >
            Add Flock Reminder
          </button>
        </div>

        {showReminderFormForFlock && flock && ( // Ensure flock is not null
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 transition-opacity">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <ReminderForm
                  existingReminder={editingFlockReminder}
                  onClose={() => { setShowReminderFormForFlock(false); setEditingFlockReminder(null); fetchData(); }}
                  // Pass flockId to pre-fill in ReminderForm if it supports it, or handle inside ReminderForm
                  // For now, ReminderForm might not directly use flockId, but it's good context.
                  // Alternatively, ReminderForm could be enhanced to accept a default flock_id.
                  // For simplicity, we'll rely on the user selecting/confirming if ReminderForm shows a flock selector.
                  // If ReminderForm is generic, the link is implicit via the page context.
                />
              </div>
            </div>
          </div>
        )}

        {flockReminders.length === 0 && !showReminderFormForFlock ? (
          <p className="text-gray-500">No reminders specifically for this flock.</p>
        ) : (
          !showReminderFormForFlock && <ul className="space-y-2">
            {flockReminders.map(reminder => {
              const isOverdue = !reminder.is_completed && new Date(reminder.reminder_date) < new Date();
              let cardBgColor = 'bg-orange-50'; // Default for pending (yellowish)
              let titleColor = 'text-orange-700';
              let dateColor = 'text-gray-600';

              if (reminder.is_completed) {
                cardBgColor = 'bg-green-50';
                titleColor = 'text-green-700';
              } else if (isOverdue) {
                cardBgColor = 'bg-red-50'; // Overdue color
                titleColor = 'text-red-700';
                dateColor = 'text-red-600 font-medium';
              }
              
              return (
              <li key={reminder.id} className={`p-3 rounded shadow-sm ${cardBgColor}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium ${titleColor}`}>{reminder.activity_type} {isOverdue && !reminder.is_completed && <span className="text-xs font-normal">(Overdue)</span>}</p>
                    <p className={`text-sm ${dateColor}`}>
                      Due: {new Date(reminder.reminder_date).toLocaleDateString()}
                    </p>
                    {reminder.notes && <p className="text-xs text-gray-500 mt-1">Notes: {reminder.notes}</p>}
                     {reminder.is_completed && reminder.completed_at && (
                        <p className="text-xs text-green-600 mt-1">Completed: {new Date(reminder.completed_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="space-x-1 flex-shrink-0 mt-1">
                     <button
                        onClick={() => handleToggleFlockReminderComplete(reminder)}
                        title={reminder.is_completed ? "Mark as Incomplete" : "Mark as Complete"}
                        className={`p-1 rounded-full ${reminder.is_completed ? 'hover:bg-yellow-100' : 'hover:bg-green-100'}`}
                      >
                        {reminder.is_completed ? <XCircleIcon className="h-5 w-5 text-yellow-500" /> : <CheckCircleIcon className="h-5 w-5 text-green-500" />}
                      </button>
                     <button
                        onClick={() => { setEditingFlockReminder(reminder); setShowReminderFormForFlock(true);}}
                        title="Edit Reminder"
                        className="p-1 rounded-full hover:bg-gray-100"
                        disabled={reminder.is_completed === 1}
                      >
                        <PencilSquareIcon className={`h-5 w-5 ${reminder.is_completed ? 'text-gray-400' : 'text-blue-500'}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteFlockReminder(reminder.id)}
                        title="Delete Reminder"
                        className="p-1 rounded-full hover:bg-gray-100"
                      >
                        <TrashIcon className="h-5 w-5 text-red-500" />
                      </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}