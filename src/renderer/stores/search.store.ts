import { create } from 'zustand';
import type { SearchResult } from '../lib/search';

interface SearchState {
  query: string;
  results: SearchResult[];
  activeResultIdx: number;
  isSearching: boolean;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setActiveResultIdx: (idx: number) => void;
  setIsSearching: (isSearching: boolean) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  activeResultIdx: 0,
  isSearching: false,
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results, activeResultIdx: 0 }),
  setActiveResultIdx: (activeResultIdx) => set({ activeResultIdx }),
  setIsSearching: (isSearching) => set({ isSearching }),
  clear: () => set({ query: '', results: [], activeResultIdx: 0, isSearching: false }),
}));
