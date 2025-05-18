'use client';

import React from 'react';
import { Tree } from '@/lib/db';

interface TreeListProps {
  trees: Tree[];
  onEdit: (tree: Tree) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function TreeList({ trees, onEdit, onDelete, isDeleting }: TreeListProps) {
  const activeTrees = trees.filter(tree => tree.is_deleted !== 1);

  if (activeTrees.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No trees recorded yet. Add your first tree!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Identifier</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Species</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Variety</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Planting Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Location</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Plot</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeTrees.map((tree) => (
            <tr key={tree.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{tree.identifier || 'N/A'}</td>
              <td className="py-3 px-5">{tree.species || 'N/A'}</td>
              <td className="py-3 px-5">{tree.variety || 'N/A'}</td>
              <td className="py-3 px-5">{tree.planting_date ? new Date(tree.planting_date).toLocaleDateString() : 'N/A'}</td>
              <td className="py-3 px-5">{tree.location_description || 'N/A'}</td>
              <td className="py-3 px-5">{tree.plot_affected || 'N/A'}</td>
              <td className="py-3 px-5 text-center">
                {tree._synced === 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : tree._synced === 1 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Synced
                  </span>
                ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Unknown
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-center space-x-2">
                <button
                  onClick={() => onEdit(tree)}
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-150"
                  disabled={isDeleting === tree.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(tree.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === tree.id}
                >
                  {isDeleting === tree.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}