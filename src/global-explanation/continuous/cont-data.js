/**
 * Create rectangles in SVG path format tracing the standard deviations at each
 * point in the model.
 * @param featureData
 */
export const createConfidenceData = (featureData) => {

  let confidenceData = [];

  for (let i = 0; i < featureData.additive.length; i++) {
    let curValue = featureData.additive[i];
    let curError = featureData.error[i];

    confidenceData.push({
      x1: featureData.binEdge[i],
      y1: curValue + curError,
      x2: featureData.binEdge[i + 1],
      y2: curValue - curError
    });
  }

  // Right bound
  let rightValue = featureData.additive[featureData.additive.length - 1];
  let rightError = featureData.error[featureData.additive.length - 1];

  confidenceData.push({
    x1: featureData.binEdge[featureData.additive.length - 1],
    y1: rightValue + rightError,
    x2: featureData.binEdge[featureData.additive.length - 1],
    y2: rightValue - rightError
  });

  return confidenceData;
};

/**
 * Create line segments (path) to trace the additive term at each bin in the
 * model.
 * @param featureData
 */
export const createAdditiveData = (featureData) => {
  let additiveData = [];

  for (let i = 0; i < featureData.additive.length - 1; i++) {

    // Compute the source point and the target point
    let sx = featureData.binEdge[i];
    let sy = featureData.additive[i];
    let tx = featureData.binEdge[i + 1];
    let ty = featureData.additive[i + 1];

    // Add line segments (need two segments to connect two points)
    // We separate these two lines so it is easier to drag
    additiveData.push({
      x1: sx,
      y1: sy,
      x2: tx,
      y2: sy,
      id: i,
      pos: 'r',
      sx: sx,
      sy: sy
    });

    additiveData.push({
      x1: tx,
      y1: sy,
      x2: tx,
      y2: ty,
      id: i + 1,
      pos: 'l',
      sx: sx,
      sy: sy
    });
  }

  // Connect the last two points (because max point has no additive value, it
  // does not have a left edge)
  additiveData.push({
    x1: featureData.binEdge[featureData.additive.length - 1],
    y1: featureData.additive[featureData.additive.length - 1],
    x2: featureData.binEdge[featureData.additive.length],
    y2: featureData.additive[featureData.additive.length - 1],
    id: featureData.additive.length - 1,
    pos: 'r',
    sx: featureData.binEdge[featureData.additive.length - 1],
    sy: featureData.additive[featureData.additive.length - 1]
  });

  return additiveData;
};

/**
 * Create nodes where each step function begins
 * @param featureData
 */
export const createPointData = (featureData) => {
  let pointData = [];

  for (let i = 0; i < featureData.additive.length; i++) {
    pointData.push({
      x: featureData.binEdge[i],
      y: featureData.additive[i],
      id: i
    });
  }

  return pointData;
};