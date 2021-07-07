
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

/**
 * Shuffle the given array in place
 * @param {[any]} array 
 * @returns shuffled array
 */
export const shuffle = (array) => {

  let currentIndex = array.length;
  let randomIndex;

  while (currentIndex !== 0) {

    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // Swap random and cur index
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
};

export const l1Distance = (array1, array2) => {
  let distance = 0;

  for (let i = 0; i < array1.length; i++) {
    distance += Math.abs(array1[i] - array2[i]);
  }

  return distance;
};

export const l2Distance = (array1, array2) => {
  let distance = 0;

  for (let i = 0; i < array1.length; i++) {
    distance += (array1[i] - array2[i]) ** 2;
  }

  return Math.sqrt(distance);
};