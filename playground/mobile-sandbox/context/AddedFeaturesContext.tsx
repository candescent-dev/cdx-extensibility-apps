import * as React from 'react';

type Ctx = {
  addedFeatureIds: string[];
  addFeatureId: (id: string) => void;
};

const AddedFeaturesContext = React.createContext<Ctx | null>(null);

/**
 * Tracks ids the user added via “Add Feature” for the current app session only.
 * Resets after reload or process kill (no persistence).
 */
export function AddedFeaturesProvider({ children }: { children: React.ReactNode }) {
  const [addedFeatureIds, setAddedFeatureIds] = React.useState<string[]>([]);

  const addFeatureId = React.useCallback((id: string) => {
    setAddedFeatureIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const value = React.useMemo(() => ({ addedFeatureIds, addFeatureId }), [addedFeatureIds, addFeatureId]);

  return (
    <AddedFeaturesContext.Provider value={value}>{children}</AddedFeaturesContext.Provider>
  );
}

export function useAddedFeatures(): Ctx {
  const ctx = React.useContext(AddedFeaturesContext);
  if (!ctx) {
    throw new Error('useAddedFeatures must be used within AddedFeaturesProvider');
  }
  return ctx;
}
