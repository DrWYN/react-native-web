'use strict';

exports.__esModule = true;
function flattenArray(array) {
  function flattenDown(array, result) {
    for (var i = 0; i < array.length; i++) {
      var value = array[i];

      if (Array.isArray(value)) {
        flattenDown(value, result);
      } else if (value != null && value !== false) {
        result.push(value);
      }
    }

    return result;
  }
  return flattenDown(array, []);
}

exports.default = flattenArray;
