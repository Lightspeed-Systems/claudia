const listWrappableFunctions = require('./list-wrappable-functions');
module.exports = function loggingWrap(apiObject, options) {
	'use strict';
	if (!options || !options.log) {
		return apiObject;
	}
	const logPrefix = (options.logName && (options.logName + '.')) || '',
		magic = '__LOGGING_WRAP__',
		remapKey = function (key) {
			let oldFunc;
			if (!apiObject[key][magic]) {
				oldFunc = apiObject[key];
				apiObject[key] = function () {
					const callArgs = arguments;
					options.log(logPrefix + key, Array.prototype.slice.call(callArgs));
					return oldFunc.apply(apiObject, callArgs);
				};
				apiObject[key][magic] = magic;
			}
		};

	// AWS SDK v3 clients expose `send(command)` as their sole public method.
	// Wrap send() to log the command class name and its input.
	if (typeof apiObject.send === 'function' && !apiObject[magic]) {
		const originalSend = apiObject.send.bind(apiObject);
		apiObject.send = function (command) {
			const commandName = (command && command.constructor && command.constructor.name) || 'send';
			options.log(logPrefix + commandName, [command && command.input]);
			return originalSend(command);
		};
		apiObject[magic] = true;
		return apiObject;
	}

	// Legacy path: wrap every enumerable method (used by plain-object mocks in tests).
	listWrappableFunctions(apiObject).forEach(remapKey);
	return apiObject;
};
