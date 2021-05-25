
/**
 * Round a number to a given decimal.
 * @param {number} num Number to round
 * @param {number} decimal Decimal place
 * @returns number
 */
export const round = (num, decimal) => {
  return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
};


/**
 * Transpose the given 2D array.
 * @param array
 */
export const transpose2dArray = (array) => {
  let newArray = new Array(array[0].length);
  for (let j = 0; j < array[0].length; j++) {
    newArray[j] = new Array(array.length).fill(0);
  }

  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array[i].length; j++) {
      newArray[j][i] = array[i][j];
    }
  }
  return newArray;
};