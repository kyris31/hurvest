'use client';

import React, { useState, useEffect } from 'react';
import { Tree } from '@/lib/db'; // Assuming Tree interface is in db.ts, removed unused db

interface TreeFormProps {
  initialData?: Tree | null;
  onSubmit: (data: Omit<Tree, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | Tree) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function TreeForm({ initialData, onSubmit, onCancel, isSubmitting }: TreeFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [species, setSpecies] = useState('');
  const [variety, setVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [plotAffected, setPlotAffected] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setIdentifier(initialData.identifier || '');
      setSpecies(initialData.species || '');
      setVariety(initialData.variety || '');
      setPlantingDate(initialData.planting_date ? initialData.planting_date.split('T')[0] : '');
      setLocationDescription(initialData.location_description || '');
      setPlotAffected(initialData.plot_affected || '');
      setNotes(initialData.notes || '');
    } else {
      setIdentifier('');
      setSpecies('');
      setVariety('');
      setPlantingDate('');
      setLocationDescription('');
      setPlotAffected('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!identifier.trim() && !species.trim()) {
      setFormError('Either Tree Identifier or Species is required.');
      return;
    }

    const treeData = {
      identifier: identifier.trim() || undefined,
      species: species.trim() || undefined,
      variety: variety.trim() || undefined,
      planting_date: plantingDate || undefined,
      location_description: locationDescription.trim() || undefined,
      plot_affected: plotAffected.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (initialData?.id) {
      await onSubmit({ ...initialData, ...treeData });
    } else {
      await onSubmit(treeData);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Tree' : 'Add New Tree'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="treeIdentifier" className="block text-sm font-medium text-gray-700">Identifier (e.g., T-001, Name)</label>
              <input
                type="text"
                id="treeIdentifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="treeSpecies" className="block text-sm font-medium text-gray-700">Species (e.g., Olive, Apple)</label>
              <input
                type="text"
                id="treeSpecies"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="treeVariety" className="block text-sm font-medium text-gray-700">Variety (e.g., Kalamata, Fuji)</label>
            <input
              type="text"
              id="treeVariety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="treePlantingDate" className="block text-sm font-medium text-gray-700">Planting Date</label>
            <input
              type="date"
              id="treePlantingDate"
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label htmlFor="treeLocationDescription" className="block text-sm font-medium text-gray-700">General Location</label>
            <input
              type="text"
              id="treeLocationDescription"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="treePlotAffected" className="block text-sm font-medium text-gray-700">Specific Plot/Coordinates</label>
            <input
              type="text"
              id="treePlotAffected"
              value={plotAffected}
              onChange={(e) => setPlotAffected(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="treeNotes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="treeNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Tree' : 'Add Tree')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}