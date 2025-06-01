'use client';

import React from 'react';
import { CropSeason } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface CropSeasonListProps {
  cropSeasons: CropSeason[];
  onEdit: (season: CropSeason) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function CropSeasonList({ cropSeasons, onEdit, onDelete, isDeleting }: CropSeasonListProps) {
  const activeSeasons = cropSeasons.filter(season => season.is_deleted !== 1);

  if (activeSeasons.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No crop seasons found. Create your first season to start planning.</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Season Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Start Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">End Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Description</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeSeasons.map((season) => (
            <tr key={season.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{season.name}</td>
              <td className="py-3 px-5">{formatDateToDDMMYYYY(season.start_date)}</td>
              <td className="py-3 px-5">{formatDateToDDMMYYYY(season.end_date)}</td>
              <td className="py-3 px-5 truncate max-w-xs">{season.description || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-center whitespace-nowrap">
                <button
                  onClick={() => onEdit(season)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isDeleting === season.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(season.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === season.id}
                >
                  {isDeleting === season.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}