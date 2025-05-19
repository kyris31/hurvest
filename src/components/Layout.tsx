'use client'; // Layout now uses hooks, so it must be a client component

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './Navigation';
import { useOnlineStatus, triggerManualSync, startAutoSync, stopAutoSync, SyncError } from '@/lib/sync'; // Import SyncError type

interface LayoutProps {
  children: React.ReactNode;
}

// Define a more specific type for structured sync error details if not already globally defined
// This should match the structure of errors returned by pushChangesToSupabase
interface StructuredSyncErrorItem extends SyncError {
  // Inherits table, id, message, code?, details?, hint? from SyncError
  // Add any additional UI-specific properties if needed later
}

export default function Layout({ children }: LayoutProps) {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [syncErrorDetails, setSyncErrorDetails] = useState<StructuredSyncErrorItem[]>([]);


  const handleManualSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setLastSyncStatus("Syncing...");
    setSyncErrorDetails([]); // Clear previous errors on new sync attempt
    try {
      const result = await triggerManualSync();
      const pushErrorsArray = result.pushResult.errors || [];
      const fetchErrorsArray = result.fetchResult.errors || []; // Assuming fetchResult also returns structured errors
      
      const allErrors = [...pushErrorsArray, ...fetchErrorsArray];

      if (allErrors.length > 0) {
        setLastSyncStatus(`Sync completed with ${allErrors.length} error(s). See details.`);
        setSyncErrorDetails(allErrors);
        console.error("Sync errors encountered:", allErrors);
      } else {
        setLastSyncStatus("Sync successful at " + new Date().toLocaleTimeString());
        // setSyncErrorDetails([]); // Already cleared at the start
      }
    } catch (error) { // Catch errors from triggerManualSync itself
      console.error("Manual sync trigger failed:", error);
      setLastSyncStatus("Sync failed. Check console.");
      // Optionally set a generic error detail
      // setSyncErrorDetails([{ table: 'N/A', id: 'N/A', message: 'The sync process itself failed.' }]);
    } finally {
      setSyncing(false);
      // setSyncCounter(prev => { // Removed unused state update
      //   console.log('Layout: syncCounter incremented to:', prev + 1); // DEBUG
      //   return prev + 1;
      // });
    }
  }, [syncing]); // Added syncing to useCallback dependencies
  
  // Start auto-sync when component mounts and is online
  // Stop when it unmounts
  useEffect(() => {
    if (isOnline) {
      // Perform an initial sync shortly after app load if online
      setTimeout(() => {
        if (!syncing) { // Check if a sync isn't already in progress
            console.log("Initial auto-sync check...");
            handleManualSync(); // Trigger a sync
        }
      }, 5000); // Delay initial sync slightly

      startAutoSync(5); // Auto-sync every 5 minutes
    } else {
      stopAutoSync(); // Stop if offline
    }
    return () => {
      stopAutoSync();
    };
  }, [isOnline, syncing, handleManualSync]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation
        isOnline={isOnline}
        syncing={syncing}
        lastSyncStatus={lastSyncStatus}
        syncErrorDetails={syncErrorDetails} // Pass error details to Navigation
        onManualSync={handleManualSync}
        onClearSyncErrors={() => setSyncErrorDetails([])} // Add a way to clear errors
      />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Render children directly. If pages need syncCounter, it should be provided via Context or passed differently. */}
        {children}
      </main>
      <footer className="bg-gray-100 text-center p-4 text-sm text-gray-600 border-t">
        © {new Date().getFullYear()} K.K. Biofresh - Hurvesthub v1.0
      </footer>
    </div>
  );
}