'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import type { FeedLog, InputInventory } from '@/lib/db'; // Assuming feed types might come from InputInventory
import { requestPushChanges } from '@/lib/sync';

interface FeedLogFormProps {
  flockId: string;
  initialData?: FeedLog | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

export default function FeedLogForm({ flockId, initialData, onSubmitSuccess, onCancel }: FeedLogFormProps) {
  const [feedDate, setFeedDate] = useState('');
  const [feedTypeId, setFeedTypeId] = useState<string | undefined>(undefined); // Example: could be ID from input_inventory
  const [quantityFedKg, setQuantityFedKg] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedOptions, setFeedOptions] = useState<InputInventory[]>([]); // For a dropdown of feed types

  // Store original values for edit comparison
  const [originalQuantityFedKg, setOriginalQuantityFedKg] = useState<number | null>(null);
  const [originalFeedTypeId, setOriginalFeedTypeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Fetch feed types (e.g., from input_inventory where type is 'Feed')
    const fetchFeedOptions = async () => {
      try {
        // This is an example; adjust the filter as per your actual feed type storage
        const feeds = await db.inputInventory.where('type').equalsIgnoreCase('Feed').and(item => item.is_deleted !== 1).toArray();
        setFeedOptions(feeds);
      } catch (err) {
        console.error("Failed to fetch feed options:", err);
      }
    };
    fetchFeedOptions();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFeedDate(initialData.feed_date ? initialData.feed_date.split('T')[0] : '');
      setFeedTypeId(initialData.feed_type_id || undefined);
      setQuantityFedKg(initialData.quantity_fed_kg ?? '');
      setNotes(initialData.notes || '');
      // Store original values for edit logic
      setOriginalQuantityFedKg(initialData.quantity_fed_kg ?? null);
      setOriginalFeedTypeId(initialData.feed_type_id || undefined);
    } else {
      setFeedDate(new Date().toISOString().split('T')[0]); // Default to today
      setFeedTypeId(undefined);
      setQuantityFedKg('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsProcessing(true);

    if (!feedDate) {
      setError("Feed date is required.");
      setIsProcessing(false);
      return;
    }
    if (quantityFedKg === '' || quantityFedKg === null || isNaN(Number(quantityFedKg)) || Number(quantityFedKg) <= 0) {
      setError("Quantity fed must be a positive number.");
      setIsProcessing(false);
      return;
    }

    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if (initialData?.id) { // Editing existing log
        let calculatedFeedCost: number | undefined = undefined;
        if (feedTypeId && Number(quantityFedKg) > 0) {
          const feedItem = await db.inputInventory.get(feedTypeId);
          if (feedItem && feedItem.total_purchase_cost && feedItem.initial_quantity && feedItem.initial_quantity > 0) {
            const costPerUnit = feedItem.total_purchase_cost / feedItem.initial_quantity;
            calculatedFeedCost = costPerUnit * Number(quantityFedKg);
          } else if (feedItem) {
            console.warn(`Could not calculate cost for feed item ${feedTypeId} during edit: missing cost or initial quantity data.`);
          }
        }

        const updates: Partial<FeedLog> = {
          feed_date: feedDate,
          feed_type_id: feedTypeId || undefined,
          quantity_fed_kg: Number(quantityFedKg),
          feed_cost: calculatedFeedCost, // Add calculated feed_cost
          notes: notes || undefined,
          updated_at: now,
        };
        await db.feed_logs.update(initialData.id, updates);
        await db.markForSync('feed_logs', initialData.id, updates);
        console.log(`Feed log ${initialData.id} updated (cost: ${updates.feed_cost}) and marked for sync.`);

        // Adjust inventory for edit
        const quantityChange = (Number(quantityFedKg) || 0) - (originalQuantityFedKg || 0);

        if (feedTypeId === originalFeedTypeId && feedTypeId) { // Feed type unchanged
          if (quantityChange !== 0) {
            const feedItem = await db.inputInventory.get(feedTypeId);
            if (feedItem && feedItem.current_quantity !== undefined) {
              const newInventoryQuantity = Math.max(0, (feedItem.current_quantity || 0) - quantityChange);
              const inventoryUpdate: Partial<InputInventory> = { current_quantity: newInventoryQuantity, updated_at: now };
              await db.inputInventory.update(feedTypeId, inventoryUpdate);
              await db.markForSync('inputInventory', feedTypeId, inventoryUpdate);
              console.log(`Adjusted inventory for ${feedTypeId} by ${-quantityChange}kg. New qty: ${newInventoryQuantity}`);
            }
          }
        } else { // Feed type changed OR one was undefined
          // Add back to original feed type's inventory (if it existed)
          if (originalFeedTypeId && originalQuantityFedKg !== null && originalQuantityFedKg > 0) {
            const oldFeedItem = await db.inputInventory.get(originalFeedTypeId);
            if (oldFeedItem && oldFeedItem.current_quantity !== undefined) {
              const newOldInventoryQuantity = (oldFeedItem.current_quantity || 0) + originalQuantityFedKg;
              const oldInventoryUpdate: Partial<InputInventory> = { current_quantity: newOldInventoryQuantity, updated_at: now };
              await db.inputInventory.update(originalFeedTypeId, oldInventoryUpdate);
              await db.markForSync('inputInventory', originalFeedTypeId, oldInventoryUpdate);
              console.log(`Returned ${originalQuantityFedKg}kg to original feed ${originalFeedTypeId}. New qty: ${newOldInventoryQuantity}`);
            }
          }
          // Deduct from new feed type's inventory (if it exists)
          if (feedTypeId && Number(quantityFedKg) > 0) {
            const newFeedItem = await db.inputInventory.get(feedTypeId);
            if (newFeedItem && newFeedItem.current_quantity !== undefined) {
              const newNewInventoryQuantity = Math.max(0, (newFeedItem.current_quantity || 0) - Number(quantityFedKg));
              const newInventoryUpdate: Partial<InputInventory> = { current_quantity: newNewInventoryQuantity, updated_at: now };
              await db.inputInventory.update(feedTypeId, newInventoryUpdate);
              await db.markForSync('inputInventory', feedTypeId, newInventoryUpdate);
              console.log(`Deducted ${quantityFedKg}kg from new feed ${feedTypeId}. New qty: ${newNewInventoryQuantity}`);
            }
          }
        }
      } else { // Adding new log
        let newLogFeedCost: number | undefined = undefined;
        if (feedTypeId && Number(quantityFedKg) > 0) {
          const feedItem = await db.inputInventory.get(feedTypeId);
          if (feedItem && feedItem.total_purchase_cost && feedItem.initial_quantity && feedItem.initial_quantity > 0) {
            const costPerUnit = feedItem.total_purchase_cost / feedItem.initial_quantity;
            newLogFeedCost = costPerUnit * Number(quantityFedKg);
          } else if (feedItem) {
            console.warn(`Could not calculate cost for new feed log with item ${feedTypeId}: missing cost or initial quantity data.`);
          }
        }

        const newLogData: Omit<FeedLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> = {
          flock_id: flockId,
          feed_date: feedDate,
          feed_type_id: feedTypeId || undefined,
          quantity_fed_kg: Number(quantityFedKg),
          feed_cost: newLogFeedCost, // Add calculated feed_cost
          notes: notes || undefined,
        };
        
        const id = crypto.randomUUID();
        const logToAdd: FeedLog = {
            ...newLogData,
            id,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
        };
        await db.feed_logs.add(logToAdd);
        console.log(`New feed log ${id} for flock ${flockId} added (cost: ${logToAdd.feed_cost}) and marked for sync.`);

        // Deduct from InputInventory if feed_type_id is selected and quantity is valid
        if (feedTypeId && Number(quantityFedKg) > 0) { // Ensure quantityFedKg is a positive number
          const feedItem = await db.inputInventory.get(feedTypeId);
          if (feedItem && feedItem.current_quantity !== undefined) {
            const newQuantity = Math.max(0, (feedItem.current_quantity || 0) - Number(quantityFedKg));
            const inventoryUpdate: Partial<InputInventory> = {
              current_quantity: newQuantity,
              updated_at: now, // Ensure updated_at is also set for the inventory item
            };
            await db.inputInventory.update(feedTypeId, inventoryUpdate);
            await db.markForSync('inputInventory', feedTypeId, inventoryUpdate);
            console.log(`Updated inventory for feed item ${feedTypeId}. New quantity: ${newQuantity}`);
          }
        }
      }
      await requestPushChanges();
      onSubmitSuccess();
    } catch (err) {
      console.error("Failed to save feed log:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="my-4 p-4 bg-white shadow rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-gray-700">
        {initialData ? 'Edit Feed Log' : 'Add New Feed Log'}
      </h3>
      {error && <p className="text-red-500 mb-3 p-2 bg-red-50 rounded-md">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="feedDate" className="block text-sm font-medium text-gray-700">Feed Date <span className="text-red-500">*</span></label>
          <input type="date" name="feedDate" id="feedDate" value={feedDate} onChange={(e) => setFeedDate(e.target.value)} required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div>
          <label htmlFor="feedTypeId" className="block text-sm font-medium text-gray-700">Feed Type (Optional)</label>
          <select name="feedTypeId" id="feedTypeId" value={feedTypeId || ''} onChange={(e) => setFeedTypeId(e.target.value || undefined)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="">Select feed type (optional)</option>
            {feedOptions.map(feed => (
              <option key={feed.id} value={feed.id}>{feed.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantityFedKg" className="block text-sm font-medium text-gray-700">Quantity Fed (kg) <span className="text-red-500">*</span></label>
          <input type="number" name="quantityFedKg" id="quantityFedKg" value={quantityFedKg} 
            onChange={(e) => setQuantityFedKg(e.target.value === '' ? '' : Number(e.target.value))} 
            min="0" step="0.01" required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea name="notes" id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Cancel
          </button>
          <button type="submit" disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            {isProcessing ? 'Saving...' : (initialData ? 'Update Log' : 'Add Log')}
          </button>
        </div>
      </form>
    </div>
  );
}