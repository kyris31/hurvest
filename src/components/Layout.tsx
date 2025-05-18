'use client'; // Layout now uses hooks, so it must be a client component

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './Navigation';
import { useOnlineStatus, triggerManualSync, startAutoSync, stopAutoSync } from '@/lib/sync';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  // const [syncCounter, setSyncCounter] = useState(0); // Removed unused state

  const handleManualSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setLastSyncStatus("Syncing...");
    try {
      const result = await triggerManualSync();
      const pushErrors = result.pushResult.errors?.length || 0;
      const fetchErrors = result.fetchResult.errors?.length || 0;
      if (pushErrors > 0 || fetchErrors > 0) {
        setLastSyncStatus(`Sync completed with ${pushErrors + fetchErrors} error(s).`);
         console.error("Sync errors:", result);
      } else {
        setLastSyncStatus("Sync successful at " + new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error("Manual sync trigger failed:", error);
      setLastSyncStatus("Sync failed. Check console.");
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
        onManualSync={handleManualSync}
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