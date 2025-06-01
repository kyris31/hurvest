'use client';

import React from 'react';
import { CropPlanTask } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface CropPlanTaskListProps {
  tasks: CropPlanTask[];
  onToggleTaskStatus: (taskId: string, currentStatus: CropPlanTask['status']) => Promise<void>;
  isUpdatingTaskId: string | null;
  // We might also want to pass stage names if tasks are grouped by stage, or resolve stage names here.
  // For simplicity now, just listing tasks.
}

export default function CropPlanTaskList({
  tasks,
  onToggleTaskStatus,
  isUpdatingTaskId,
}: CropPlanTaskListProps) {

  const activeTasks = tasks.filter(task => task.is_deleted !== 1);

  if (activeTasks.length === 0) {
    return <p className="text-center text-gray-500 py-4">No tasks generated for this plan yet.</p>;
  }
  
  const formatStatus = (status?: CropPlanTask['status']) => {
    if (!status) return 'To Do'; // Default if status is undefined
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="overflow-x-auto shadow border border-gray-200 rounded-lg">
      <table className="min-w-full bg-white divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task Description
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activeTasks.map((task) => (
            <tr key={task.id} className={`hover:bg-gray-50 ${task.status === 'DONE' ? 'bg-green-50' : ''}`}>
              <td className="px-4 py-3 whitespace-normal text-sm font-medium text-gray-900 max-w-md">
                {task.task_description}
                {task.notes && <p className="text-xs text-gray-500 mt-1">Notes: {task.notes}</p>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {formatDateToDDMMYYYY(task.planned_due_date)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  task.status === 'DONE' ? 'bg-green-100 text-green-800' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  task.status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                  task.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700 line-through' :
                  'bg-yellow-100 text-yellow-800' // TODO or undefined
                }`} >
                  {formatStatus(task.status)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                {task.status !== 'CANCELLED' && (
                  <button
                    onClick={() => onToggleTaskStatus(task.id, task.status)}
                    className={`text-xs px-3 py-1 rounded-md
                      ${task.status === 'DONE' 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'}
                      disabled:opacity-50`}
                    disabled={isUpdatingTaskId === task.id}
                  >
                    {isUpdatingTaskId === task.id 
                      ? 'Updating...' 
                      : task.status === 'DONE' ? 'Mark To Do' : 'Mark Done'}
                  </button>
                )}
                {/* TODO: Add Edit/Delete for tasks if needed, or manage them via stages */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}