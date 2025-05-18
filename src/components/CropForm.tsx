'use client';

import React, { useState, useEffect } from 'react';
import { Crop } from '@/lib/db';

interface CropFormProps {
  initialData?: Crop;
  onSubmit: (data: Omit<Crop, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CropForm({ initialData, onSubmit, onCancel, isSubmitting }: CropFormProps) {
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState(''); // Added notes state
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setVariety(initialData.variety || '');
      setType(initialData.type || '');
      setNotes(initialData.notes || ''); // Initialize notes
    } else {
      setName('');
      setVariety('');
      setType('');
      setNotes(''); // Reset notes
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Crop Name is required.');
      return;
    }
    // Variety is optional, but if provided, it should be trimmed.
    // Type (category) is also optional.
    await onSubmit({
      name: name.trim(),
      variety: variety.trim() || undefined,
      type: type.trim() || undefined,
      notes: notes.trim() || undefined // Add notes to submitted data
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Crop' : 'Add New Crop'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm p-2 bg-red-50 rounded">{formError}</p>}
          <div>
            <label htmlFor="cropName" className="block text-sm font-medium text-gray-700">
              Crop Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="cropName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="cropVariety" className="block text-sm font-medium text-gray-700">
              Variety (e.g., Cherry, Roma for Tomato)
            </label>
            <input
              type="text"
              id="cropVariety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="cropType" className="block text-sm font-medium text-gray-700">
              Crop Type/Category (e.g., Fruit, Vegetable, Herb)
            </label>
            <input
              type="text"
              id="cropType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="cropNotes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="cropNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder="Optional notes about the crop"
            />
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
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
              {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Crop')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}