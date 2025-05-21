'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // For query params
import { db, Tree } from '@/lib/db';
import TreeList from '@/components/TreeList';
import TreeForm from '@/components/TreeForm';

export default function TreesPage() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTree, setEditingTree] = useState<Tree | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setEditingTree(null);
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const treesData = await db.trees.orderBy('identifier').filter(t => t.is_deleted !== 1).toArray();
      setTrees(treesData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch trees data:", err);
      setError("Failed to load tree data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormSubmit = async (data: Omit<Tree, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | Tree) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if ('id' in data && data.id) { // Editing existing
        const updatedTree: Partial<Tree> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.trees.update(data.id, updatedTree);
      } else { // Adding new
        const newTreeData: Omit<Tree, 'id'> = {
          ...(data as Omit<Tree, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.trees.add({ ...newTreeData, id });
      }
      await fetchData();
      setShowForm(false);
      setEditingTree(null);
      if (searchParams.get('action') === 'add') {
        router.replace('/trees', undefined); // Clear query param
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save tree. Please try again.";
      console.error("Failed to save tree:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tree: Tree) => {
    setEditingTree(tree);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this tree record?")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync('trees', id, {}, true);
        await fetchData();
      } catch (err) {
        console.error("Failed to delete tree:", err);
        setError("Failed to delete tree.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tree Records</h1>
          <button
            onClick={() => { setEditingTree(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Tree
          </button>
        </div>
      </header>

      {showForm && (
        <TreeForm
          initialData={editingTree}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingTree(null);
            setError(null);
            if (searchParams.get('action') === 'add') {
              router.replace('/trees', undefined); // Clear query param on cancel
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading tree records...</p>}
        {!isLoading && !error && (
          <TreeList
            trees={trees}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && trees.length === 0 && !error && (
           <div className="text-center py-10">
            {/* You can use an appropriate icon here, e.g., a tree icon */}
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.75l-7.5-7.5-7.5 7.5m15 6l-7.5-7.5-7.5 7.5" /> {/* Placeholder icon */}
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No trees recorded</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new tree.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingTree(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add New Tree
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}