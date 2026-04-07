const retry = require('oh-no-i-insist');

// Wraps an AWS SDK v3 client so that calling client.someMethodPromise(params)
// looks up SomeMethodCommand from commandsModule, sends it, and retries on
// TooManyRequestsException. The suffix (default 'Promise') matches the
// naming convention used throughout this codebase.
module.exports = function retriableWrap(client, commandsModule, onRetry, timeout, retries) {
	'use strict';
	timeout = timeout || 3000;
	retries = retries || 10;
	const suffix = 'Promise';
	return new Proxy(client, {
		get(target, prop) {
			if (typeof prop === 'string' && prop.endsWith(suffix)) {
				const methodName = prop.slice(0, -suffix.length),
					commandName = methodName[0].toUpperCase() + methodName.slice(1) + 'Command',
					CommandClass = commandsModule[commandName];
				if (CommandClass) {
					return (params) => retry(
						() => target.send(new CommandClass(params)),
						timeout,
						retries,
						failure => failure.name === 'TooManyRequestsException',
						onRetry,
						Promise
					);
				}
			}
			const value = target[prop];
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
};
