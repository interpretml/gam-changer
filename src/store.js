import { writable } from 'svelte/store';

export const multiSelectMenuStore = writable({
  moveMode: false,
  toSwitchMoveMode: false,
  subItemMode: null,
  increment: 0,
  step: 3,
  inplaceInterpolation: true
});

export const tooltipConfigStore = writable({});
