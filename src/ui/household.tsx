import { createContext, useContext } from 'react';
import type { Household } from '../data/repo';

export interface HouseholdState {
  household: Household;
  userId: string;
  reload: () => void;
}

export const HouseholdContext = createContext<HouseholdState | null>(null);

export function useHousehold(): HouseholdState {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold outside HouseholdContext');
  return value;
}
