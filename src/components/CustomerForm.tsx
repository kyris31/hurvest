'use client';

import React, { useState, useEffect } from 'react';
import { Customer } from '@/lib/db'; // Removed unused db import

interface CustomerFormProps {
  initialData?: Customer | null;
  onSubmit: (data: Omit<Customer, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | Customer) => Promise<string | void>; // Returns ID if new
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CustomerForm({ initialData, onSubmit, onCancel, isSubmitting }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<'Individual' | 'Commercial'>('Individual');
  const [contactInfo, setContactInfo] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCustomerType(initialData.customer_type || 'Individual');
      setContactInfo(initialData.contact_info || '');
      setAddress(initialData.address || '');
    } else {
      setName('');
      setCustomerType('Individual');
      setContactInfo('');
      setAddress('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    const customerData = {
      name: name.trim(),
      customer_type: customerType,
      contact_info: contactInfo.trim() || undefined,
      address: address.trim() || undefined,
    };

    await onSubmit(initialData ? { ...initialData, ...customerData } : customerData);
  };

  return (
    // This form might be used in a modal or inline
    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        {initialData ? 'Edit Customer' : 'Add New Customer'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}
        
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="customerName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="customerType" className="block text-sm font-medium text-gray-700">
            Customer Type <span className="text-red-500">*</span>
          </label>
          <select
            id="customerType"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as 'Individual' | 'Commercial')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            required
            disabled={isSubmitting}
          >
            <option value="Individual">Individual</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>

        <div>
          <label htmlFor="customerContact" className="block text-sm font-medium text-gray-700">Contact Info (Phone/Email)</label>
          <input
            type="text"
            id="customerContact"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700">Address</label>
          <textarea
            id="customerAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Customer' : 'Add Customer')}
          </button>
        </div>
      </form>
    </div>
  );
}