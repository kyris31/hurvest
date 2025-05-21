'use client'; // Layout now uses hooks, so it must be a client component

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter and usePathname
import Navigation from './Navigation';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import type { Session } from '@supabase/supabase-js'; // Import Session type
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
  const [isUserAuthenticatedForSync, setIsUserAuthenticatedForSync] = useState(false);
  const [currentUserSession, setCurrentUserSession] = useState<Session | null>(null);
  const [authProcessed, setAuthProcessed] = useState(false); // To track if initial auth state is processed
  const router = useRouter();
  const pathname = usePathname();
  const autoSyncProcessStartedRef = useRef(false); // Moved to top level

  const handleAutoSyncSuccess = useCallback((message: string) => {
    setLastSyncStatus(message);
    setSyncErrorDetails([]); // Clear errors on successful auto-sync
    console.log("Layout: Auto-sync success reported:", message);
  }, []); // Empty deps as it only uses setters

  const handleAutoSyncError = useCallback((errors: SyncError[]) => {
    setLastSyncStatus(`Auto-sync completed with ${errors.length} error(s).`);
    setSyncErrorDetails(errors);
    console.log("Layout: Auto-sync error reported:", errors);
  }, []); // Empty deps as it only uses setters

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
    let initialSyncTimeoutId: NodeJS.Timeout | undefined;
    let autoSyncStartedRef = false; // Using a ref-like variable to track if auto-sync has been initiated by this effect

    // Listen for auth changes to set a flag
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Layout: Auth state changed:", event, session);
      setCurrentUserSession(session); // Update current session state
      setAuthProcessed(true); // Explicitly mark that initial auth state has been processed

      if (event === "SIGNED_IN") {
        if (session?.user) {
          console.log("Layout: User SIGNED_IN. Marking as authenticated for sync.");
          setIsUserAuthenticatedForSync(true);
        } else {
          // This case should ideally not happen for SIGNED_IN, but as a safeguard:
          console.log("Layout: SIGNED_IN event but no user session. Marking as not authenticated.");
          setIsUserAuthenticatedForSync(false);
        }
      } else if (event === "TOKEN_REFRESHED") {
        if (session?.user) {
          console.log("Layout: Token REFRESHED with user session. Maintaining authenticated state.");
          setIsUserAuthenticatedForSync(true);
        } else {
          console.log("Layout: Token REFRESHED but no user session. Marking as not authenticated.");
          setIsUserAuthenticatedForSync(false); // If token refresh fails to produce a session
        }
      } else if (event === "INITIAL_SESSION") {
        if (session?.user) {
          console.log("Layout: INITIAL_SESSION with user session. Marking as authenticated for sync.");
          setIsUserAuthenticatedForSync(true);
        } else {
          console.log("Layout: INITIAL_SESSION with no user session. User is not yet authenticated.");
          setIsUserAuthenticatedForSync(false);
        }
      } else if (event === "SIGNED_OUT") {
        console.log("Layout: User SIGNED_OUT.");
        setIsUserAuthenticatedForSync(false);
        // initialSyncTimeoutId and autoSyncStartedRef are local to the other useEffect,
        // their cleanup on SIGNED_OUT should be handled within that effect's logic or by re-evaluating conditions.
        // For now, just ensure sync is stopped and status updated.
        stopAutoSync();
        setLastSyncStatus("User signed out. Sync stopped.");
        setSyncErrorDetails([]);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      if (initialSyncTimeoutId) clearTimeout(initialSyncTimeoutId);
      // Stop auto-sync if it was started by this component instance,
      // it will be restarted if needed when a new session is established.
      if (autoSyncStartedRef) {
        stopAutoSync();
      }
    };
  }, []); // Only run on mount and unmount for setting up/tearing down the auth listener

  // Effect to handle starting/stopping sync based on auth status and online status
  useEffect(() => {
    let initialSyncTimeoutId: NodeJS.Timeout | undefined;
    let setupDelayTimeoutId: NodeJS.Timeout | undefined;
    // const autoSyncProcessStartedRef = useRef(false); // Moved to top level

    const setupAndStartSync = async () => {
      // This function will now be called after a delay if isUserAuthenticatedForSync becomes true
      if (isOnline && isUserAuthenticatedForSync && !autoSyncProcessStartedRef.current) {
        console.log("Layout: Conditions met (online, authenticated). Proceeding with sync setup.");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log("Layout: Final check passed: User session exists. Performing initial sync and starting auto-sync.");
          if (!syncing) {
            initialSyncTimeoutId = setTimeout(() => {
              if (!syncing) handleManualSync();
            }, 500);
          }
          startAutoSync(5, handleAutoSyncSuccess, handleAutoSyncError);
          autoSyncProcessStartedRef.current = true;
        } else {
          console.log("Layout: Final check failed: User session not fully authenticated. Auto-sync not started.");
        }
      }
    };

    if (isOnline && isUserAuthenticatedForSync && !autoSyncProcessStartedRef.current) {
      console.log("Layout: User authenticated and online. Delaying sync setup for session propagation.");
      setupDelayTimeoutId = setTimeout(() => {
        setupAndStartSync();
      }, 2500);
    } else if ((!isOnline || !isUserAuthenticatedForSync) && autoSyncProcessStartedRef.current) {
      console.log(`Layout: Conditions for sync no longer met (Online: ${isOnline}, Auth: ${isUserAuthenticatedForSync}). Stopping auto-sync.`);
      if (initialSyncTimeoutId) clearTimeout(initialSyncTimeoutId);
      if (setupDelayTimeoutId) clearTimeout(setupDelayTimeoutId);
      stopAutoSync();
      autoSyncProcessStartedRef.current = false;
    }

    return () => {
      if (initialSyncTimeoutId) clearTimeout(initialSyncTimeoutId);
      if (setupDelayTimeoutId) clearTimeout(setupDelayTimeoutId);
      // Only stop sync if this effect instance actually started it and it's still marked as started.
      // This prevents stopping a sync started by a subsequent effect run if conditions flap.
      if (autoSyncProcessStartedRef.current && (!isOnline || !isUserAuthenticatedForSync)) {
         console.log("Layout: Cleanup - stopping auto-sync because conditions are no longer met.");
         stopAutoSync();
         autoSyncProcessStartedRef.current = false;
      }
    };
  }, [isOnline, isUserAuthenticatedForSync, syncing, handleManualSync]);

  // Effect for redirecting unauthenticated users
  useEffect(() => {
    if (authProcessed && !currentUserSession && pathname !== '/auth') {
      console.log("Layout: User not authenticated, redirecting to /auth from", pathname);
      router.replace('/auth');
    }
  }, [authProcessed, currentUserSession, pathname, router]);

  // Render loading state or null if auth not processed and not on auth page, to prevent flash of content
  if (!authProcessed && pathname !== '/auth') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading application...</div>
      </div>
    );
  }
  
  // If user is not authenticated and trying to access a protected page,
  // this will be caught by the effect above after authProcessed is true.
  // If on /auth page, always render it.
  if (!currentUserSession && pathname !== '/auth' && authProcessed) {
     // This case should ideally be handled by the redirect, but as a fallback:
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div>Redirecting to login...</div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation
        isOnline={isOnline}
        syncing={syncing}
        lastSyncStatus={lastSyncStatus}
        syncErrorDetails={syncErrorDetails}
        onManualSync={handleManualSync}
        onClearSyncErrors={() => setSyncErrorDetails([])}
        currentUserSession={currentUserSession} // Pass session to Navigation
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