'use client';

import React, { useState, useEffect } from 'react';
import { Plot } from '@/lib/db';

interface PlotFormProps {
  initialData?: Plot | null;
  onSubmit: (data: Omit<Plot, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | Plot) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const PLOT_STATUSES = ['active', 'fallow', 'in_use', 'needs_prep', 'archived'];

export default function PlotForm({ initialData, onSubmit, onCancel, isSubmitting }: PlotFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lengthM, setLengthM] = useState<number | ''>('');
  const [widthM, setWidthM] = useState<number | ''>('');
  const [areaSqm, setAreaSqm] = useState<number | ''>('');
  const [status, setStatus] = useState<Plot['status']>('active');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setLengthM(initialData.length_m ?? '');
      setWidthM(initialData.width_m ?? '');
      setAreaSqm(initialData.area_sqm ?? '');
      setStatus(initialData.status || 'active');
    } else {
      setName('');
      setDescription('');
      setLengthM('');
      setWidthM('');
      setAreaSqm('');
      setStatus('active');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Plot name is required.');
      return;
    }

    const plotData = {
      name: name.trim(),
      description: description.trim() || undefined,
      length_m: lengthM === '' ? undefined : Number(lengthM),
      width_m: widthM === '' ? undefined : Number(widthM),
      area_sqm: areaSqm === '' ? undefined : Number(areaSqm),
      status: status,
    };

    if (initialData?.id) {
      await onSubmit({ ...initialData, ...plotData });
    } else {
      await onSubmit(plotData as Omit<Plot, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>);
    }
  };
  
  // Auto-calculate area if length and width are provided
  useEffect(() => {
    if (typeof lengthM === 'number' && typeof widthM === 'number' && lengthM > 0 && widthM > 0) {
      setAreaSqm(parseFloat((lengthM * widthM).toFixed(2)));
    } else if (lengthM === '' || widthM === '') {
      // If one is cleared, don't auto-clear area if it was manually entered
    }
  }, [lengthM, widthM]);


  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Plot' : 'Create New Plot'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label htmlFor="plotName" className="block text-sm font-medium text-gray-700">
              Plot Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="plotName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="plotDescription" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="plotDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="plotLength" className="block text-sm font-medium text-gray-700">Length (m)</label>
              <input
                type="number"
                id="plotLength"
                value={lengthM}
                onChange={(e) => setLengthM(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="plotWidth" className="block text-sm font-medium text-gray-700">Width (m)</label>
              <input
                type="number"
                id="plotWidth"
                value={widthM}
                onChange={(e) => setWidthM(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="plotArea" className="block text-sm font-medium text-gray-700">Area (sqm)</label>
              <input
                type="number"
                id="plotArea"
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="any"
                readOnly={typeof lengthM === 'number' && typeof widthM === 'number' && lengthM > 0 && widthM > 0} // Readonly if auto-calculated
              />
            </div>
          </div>

          <div>
            <label htmlFor="plotStatus" className="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="plotStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as Plot['status'])}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              {PLOT_STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
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
              {isSubmitting ? (initialData ? 'Saving...' : 'Creating...') : (initialData ? 'Save Changes' : 'Create Plot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}