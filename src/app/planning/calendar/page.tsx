'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CropPlanStage, CropPlan, Crop } from '@/lib/db';
import Link from 'next/link';
import { Calendar, momentLocalizer, EventProps, CalendarProps } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string; // stage.id
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any; // For linking back to the original stage/plan
}

export default function PlanningCalendarPage() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stages = useLiveQuery(
    async () => db.cropPlanStages.where('is_deleted').notEqual(1).toArray(),
    []
  );

  const plans = useLiveQuery(
    async () => {
      if (!stages || stages.length === 0) return [];
      const planIds = [...new Set(stages.map(s => s.crop_plan_id))];
      return db.cropPlans.where('id').anyOf(planIds).toArray();
    },
    [stages]
  );

  const crops = useLiveQuery(
    async () => {
      if (!plans || plans.length === 0) return [];
      const cropIds = [...new Set(plans.map(p => p.crop_id).filter(id => !!id))] as string[];
      if (cropIds.length === 0) return [];
      return db.crops.where('id').anyOf(cropIds).toArray();
    },
    [plans]
  );

  useEffect(() => {
    if (stages && plans && crops) {
      try {
        const events: CalendarEvent[] = stages.map(stage => {
          const plan = plans.find(p => p.id === stage.crop_plan_id);
          const crop = plan ? crops.find(c => c.id === plan.crop_id) : undefined;
          
          const title = `${plan ? crop ? `${crop.name} ${crop.variety || ''}`.trim() : plan.plan_name : 'Unknown Plan'} - ${stage.stage_name}`;
          const startDate = new Date(stage.planned_start_date);
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + (stage.planned_duration_days || 1)); // Duration of at least 1 day

          return {
            id: stage.id,
            title: title,
            start: startDate,
            end: endDate,
            allDay: true, // Assuming stages are all-day events for now
            resource: stage, // Link back to the stage object
          };
        });
        setCalendarEvents(events);
        setError(null);
      } catch (e) {
        console.error("Error processing calendar events:", e);
        setError("Failed to prepare calendar data.");
        setCalendarEvents([]);
      }
    }
  }, [stages, plans, crops]);

  const isLoading = stages === undefined || plans === undefined || crops === undefined;

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Planning Calendar
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        
        {isLoading && <p className="text-center text-gray-500">Loading calendar data...</p>}

        {!isLoading && !error && (
          <div className="bg-white p-4 rounded-lg shadow" style={{ height: 'calc(100vh - 200px)' }}> {/* Adjust height as needed */}
            {calendarEvents.length > 0 ? (
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month', 'week', 'day', 'agenda']}
                selectable
                onSelectEvent={event => router.push(`/planning/crop-plans/${(event.resource as CropPlanStage).crop_plan_id}`)}
                // onSelectSlot={(slotInfo) => {
                //   // Handle new event creation from slot select if desired
                //   console.log('Selected slot:', slotInfo);
                // }}
                components={{
                  event: EventComponent // Custom event rendering
                }}
              />
            ) : (
              <p className="text-gray-500 text-center py-10">No stages scheduled to display on the calendar.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Custom Event component to allow linking
const EventComponent: React.FC<EventProps<CalendarEvent>> = ({ event }) => {
  const stage = event.resource as CropPlanStage;
  return (
    <Link href={`/planning/crop-plans/${stage.crop_plan_id}#stage-${stage.id}`} title={event.title}>
      <div style={{ fontSize: '0.8em', padding: '2px 4px' }}>
        {event.title}
      </div>
    </Link>
  );
};