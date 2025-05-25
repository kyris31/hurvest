'use client';

import React from 'react';
import { Plot } from '@/lib/db';

interface PlotListProps {
  plots: Plot[];
  onEdit: (plot: Plot) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function PlotList({ plots, onEdit, onDelete, isDeleting }: PlotListProps) {
  const activePlots = plots.filter(plot => plot.is_deleted !== 1);

  if (activePlots.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No plots found. Create your first plot to get started with planning.</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Description</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Length (m)</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Width (m)</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Area (sqm)</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Status</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activePlots.map((plot) => (
            <tr key={plot.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{plot.name}</td>
              <td className="py-3 px-5 truncate max-w-xs">{plot.description || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-right">{plot.length_m ?? <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-right">{plot.width_m ?? <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-right">{plot.area_sqm ?? <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  plot.status === 'active' ? 'bg-blue-100 text-blue-800' :
                  plot.status === 'fallow' ? 'bg-yellow-100 text-yellow-800' :
                  plot.status === 'in_use' ? 'bg-green-100 text-green-800' :
                  plot.status === 'needs_prep' ? 'bg-purple-100 text-purple-800' :
                  plot.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-800' // Default
                }`} >
                  {plot.status ? plot.status.charAt(0).toUpperCase() + plot.status.slice(1) : 'Unknown'}
                </span>
              </td>
              <td className="py-3 px-5 text-center whitespace-nowrap">
                <button
                  onClick={() => onEdit(plot)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isDeleting === plot.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(plot.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === plot.id}
                >
                  {isDeleting === plot.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}