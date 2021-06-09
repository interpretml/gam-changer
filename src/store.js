import { writable } from 'svelte/store';

export const multiSelectMenuStore = writable({
  moveMode: false,
  increment: 0
});