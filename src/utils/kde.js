import d3 from '../utils/d3-import';

const epanechnikov = (bandwidth) => {
  return x => Math.abs(x /= bandwidth) <= 1 ? 0.75 * (1 - x * x) / bandwidth : 0;
};

export const kde = (bandwidth, thresholds, data) => {
  return thresholds.map(t => [t, d3.mean(data, d => epanechnikov(bandwidth)(t - d))]);
};