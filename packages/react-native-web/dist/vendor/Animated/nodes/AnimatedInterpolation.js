/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @providesModule AnimatedInterpolation
 *
 * @format
 */
/* eslint no-bitwise: 0 */
'use strict';

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return call && (typeof call === 'object' || typeof call === 'function') ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError(
      'Super expression must either be null or a function, not ' + typeof superClass
    );
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: { value: subClass, enumerable: false, writable: true, configurable: true }
  });
  if (superClass)
    Object.setPrototypeOf
      ? Object.setPrototypeOf(subClass, superClass)
      : (subClass.__proto__ = superClass);
}

var AnimatedNode = require('./AnimatedNode');
var AnimatedWithChildren = require('./AnimatedWithChildren');
var NativeAnimatedHelper = require('../NativeAnimatedHelper');

var invariant = require('fbjs/lib/invariant');
var normalizeColor = require('normalize-css-color');

var linear = function linear(t) {
  return t;
};

/**
 * Very handy helper to map input ranges to output ranges with an easing
 * function and custom behavior outside of the ranges.
 */
function createInterpolation(config) {
  if (config.outputRange && typeof config.outputRange[0] === 'string') {
    return createInterpolationFromStringOutputRange(config);
  }

  var outputRange = config.outputRange;
  checkInfiniteRange('outputRange', outputRange);

  var inputRange = config.inputRange;
  checkInfiniteRange('inputRange', inputRange);
  checkValidInputRange(inputRange);

  invariant(
    inputRange.length === outputRange.length,
    'inputRange (' +
      inputRange.length +
      ') and outputRange (' +
      outputRange.length +
      ') must have the same length'
  );

  var easing = config.easing || linear;

  var extrapolateLeft = 'extend';
  if (config.extrapolateLeft !== undefined) {
    extrapolateLeft = config.extrapolateLeft;
  } else if (config.extrapolate !== undefined) {
    extrapolateLeft = config.extrapolate;
  }

  var extrapolateRight = 'extend';
  if (config.extrapolateRight !== undefined) {
    extrapolateRight = config.extrapolateRight;
  } else if (config.extrapolate !== undefined) {
    extrapolateRight = config.extrapolate;
  }

  return function(input) {
    invariant(typeof input === 'number', 'Cannot interpolation an input which is not a number');

    var range = findRange(input, inputRange);
    return interpolate(
      input,
      inputRange[range],
      inputRange[range + 1],
      outputRange[range],
      outputRange[range + 1],
      easing,
      extrapolateLeft,
      extrapolateRight
    );
  };
}

function interpolate(
  input,
  inputMin,
  inputMax,
  outputMin,
  outputMax,
  easing,
  extrapolateLeft,
  extrapolateRight
) {
  var result = input;

  // Extrapolate
  if (result < inputMin) {
    if (extrapolateLeft === 'identity') {
      return result;
    } else if (extrapolateLeft === 'clamp') {
      result = inputMin;
    } else if (extrapolateLeft === 'extend') {
      // noop
    }
  }

  if (result > inputMax) {
    if (extrapolateRight === 'identity') {
      return result;
    } else if (extrapolateRight === 'clamp') {
      result = inputMax;
    } else if (extrapolateRight === 'extend') {
      // noop
    }
  }

  if (outputMin === outputMax) {
    return outputMin;
  }

  if (inputMin === inputMax) {
    if (input <= inputMin) {
      return outputMin;
    }
    return outputMax;
  }

  // Input Range
  if (inputMin === -Infinity) {
    result = -result;
  } else if (inputMax === Infinity) {
    result = result - inputMin;
  } else {
    result = (result - inputMin) / (inputMax - inputMin);
  }

  // Easing
  result = easing(result);

  // Output Range
  if (outputMin === -Infinity) {
    result = -result;
  } else if (outputMax === Infinity) {
    result = result + outputMin;
  } else {
    result = result * (outputMax - outputMin) + outputMin;
  }

  return result;
}

function colorToRgba(input) {
  var int32Color = normalizeColor(input);
  if (int32Color === null) {
    return input;
  }

  int32Color = int32Color || 0;

  var r = (int32Color & 0xff000000) >>> 24;
  var g = (int32Color & 0x00ff0000) >>> 16;
  var b = (int32Color & 0x0000ff00) >>> 8;
  var a = (int32Color & 0x000000ff) / 255;

  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
}

var stringShapeRegex = /[0-9\.-]+/g;

/**
 * Supports string shapes by extracting numbers so new values can be computed,
 * and recombines those values into new strings of the same shape.  Supports
 * things like:
 *
 *   rgba(123, 42, 99, 0.36) // colors
 *   -45deg                  // values with units
 */
function createInterpolationFromStringOutputRange(config) {
  var outputRange = config.outputRange;
  invariant(outputRange.length >= 2, 'Bad output range');
  outputRange = outputRange.map(colorToRgba);
  checkPattern(outputRange);

  // ['rgba(0, 100, 200, 0)', 'rgba(50, 150, 250, 0.5)']
  // ->
  // [
  //   [0, 50],
  //   [100, 150],
  //   [200, 250],
  //   [0, 0.5],
  // ]
  /* $FlowFixMe(>=0.18.0): `outputRange[0].match()` can return `null`. Need to
   * guard against this possibility.
   */
  var outputRanges = outputRange[0].match(stringShapeRegex).map(function() {
    return [];
  });
  outputRange.forEach(function(value) {
    /* $FlowFixMe(>=0.18.0): `value.match()` can return `null`. Need to guard
     * against this possibility.
     */
    value.match(stringShapeRegex).forEach(function(number, i) {
      outputRanges[i].push(+number);
    });
  });

  /* $FlowFixMe(>=0.18.0): `outputRange[0].match()` can return `null`. Need to
   * guard against this possibility.
   */
  var interpolations = outputRange[0].match(stringShapeRegex).map(function(value, i) {
    return createInterpolation(
      Object.assign({}, config, {
        outputRange: outputRanges[i]
      })
    );
  });

  // rgba requires that the r,g,b are integers.... so we want to round them, but we *dont* want to
  // round the opacity (4th column).
  var shouldRound = isRgbOrRgba(outputRange[0]);

  return function(input) {
    var i = 0;
    // 'rgba(0, 100, 200, 0)'
    // ->
    // 'rgba(${interpolations[0](input)}, ${interpolations[1](input)}, ...'
    return outputRange[0].replace(stringShapeRegex, function() {
      var val = +interpolations[i++](input);
      var rounded = shouldRound && i < 4 ? Math.round(val) : Math.round(val * 1000) / 1000;
      return String(rounded);
    });
  };
}

function isRgbOrRgba(range) {
  return typeof range === 'string' && range.startsWith('rgb');
}

function checkPattern(arr) {
  var pattern = arr[0].replace(stringShapeRegex, '');
  for (var i = 1; i < arr.length; ++i) {
    invariant(
      pattern === arr[i].replace(stringShapeRegex, ''),
      'invalid pattern ' + arr[0] + ' and ' + arr[i]
    );
  }
}

function findRange(input, inputRange) {
  var i = void 0;
  for (i = 1; i < inputRange.length - 1; ++i) {
    if (inputRange[i] >= input) {
      break;
    }
  }
  return i - 1;
}

function checkValidInputRange(arr) {
  invariant(arr.length >= 2, 'inputRange must have at least 2 elements');
  for (var i = 1; i < arr.length; ++i) {
    invariant(
      arr[i] >= arr[i - 1],
      /* $FlowFixMe(>=0.13.0) - In the addition expression below this comment,
     * one or both of the operands may be something that doesn't cleanly
     * convert to a string, like undefined, null, and object, etc. If you really
     * mean this implicit string conversion, you can do something like
     * String(myThing)
     */
      'inputRange must be monotonically increasing ' + arr
    );
  }
}

function checkInfiniteRange(name, arr) {
  invariant(arr.length >= 2, name + ' must have at least 2 elements');
  invariant(
    arr.length !== 2 || arr[0] !== -Infinity || arr[1] !== Infinity,
    /* $FlowFixMe(>=0.13.0) - In the addition expression below this comment,
   * one or both of the operands may be something that doesn't cleanly convert
   * to a string, like undefined, null, and object, etc. If you really mean
   * this implicit string conversion, you can do something like
   * String(myThing)
   */
    name + 'cannot be ]-infinity;+infinity[ ' + arr
  );
}

var AnimatedInterpolation = (function(_AnimatedWithChildren) {
  _inherits(AnimatedInterpolation, _AnimatedWithChildren);

  // Export for testing.
  function AnimatedInterpolation(parent, config) {
    _classCallCheck(this, AnimatedInterpolation);

    var _this = _possibleConstructorReturn(this, _AnimatedWithChildren.call(this));

    _this._parent = parent;
    _this._config = config;
    _this._interpolation = createInterpolation(config);
    return _this;
  }

  AnimatedInterpolation.prototype.__makeNative = function __makeNative() {
    this._parent.__makeNative();
    _AnimatedWithChildren.prototype.__makeNative.call(this);
  };

  AnimatedInterpolation.prototype.__getValue = function __getValue() {
    var parentValue = this._parent.__getValue();
    invariant(
      typeof parentValue === 'number',
      'Cannot interpolate an input which is not a number.'
    );
    return this._interpolation(parentValue);
  };

  AnimatedInterpolation.prototype.interpolate = function interpolate(config) {
    return new AnimatedInterpolation(this, config);
  };

  AnimatedInterpolation.prototype.__attach = function __attach() {
    this._parent.__addChild(this);
  };

  AnimatedInterpolation.prototype.__detach = function __detach() {
    this._parent.__removeChild(this);
    _AnimatedWithChildren.prototype.__detach.call(this);
  };

  AnimatedInterpolation.prototype.__transformDataType = function __transformDataType(range) {
    // Change the string array type to number array
    // So we can reuse the same logic in iOS and Android platform
    return range.map(function(value) {
      if (typeof value !== 'string') {
        return value;
      }
      if (/deg$/.test(value)) {
        var degrees = parseFloat(value) || 0;
        var radians = degrees * Math.PI / 180.0;
        return radians;
      } else {
        // Assume radians
        return parseFloat(value) || 0;
      }
    });
  };

  AnimatedInterpolation.prototype.__getNativeConfig = function __getNativeConfig() {
    if (process.env.NODE_ENV !== 'production') {
      NativeAnimatedHelper.validateInterpolation(this._config);
    }

    return {
      inputRange: this._config.inputRange,
      // Only the `outputRange` can contain strings so we don't need to tranform `inputRange` here
      outputRange: this.__transformDataType(this._config.outputRange),
      extrapolateLeft: this._config.extrapolateLeft || this._config.extrapolate || 'extend',
      extrapolateRight: this._config.extrapolateRight || this._config.extrapolate || 'extend',
      type: 'interpolation'
    };
  };

  return AnimatedInterpolation;
})(AnimatedWithChildren);

AnimatedInterpolation.__createInterpolation = createInterpolation;

module.exports = AnimatedInterpolation;
