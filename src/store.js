import { writable } from 'svelte/store';

export const multiSelectMenuStore = writable({
  moveMode: false,
  toSwitchMoveMode: false,
  subItemMode: null,
  increment: 0,
  step: 3
});

export const tooltipConfigStore = writable({});
