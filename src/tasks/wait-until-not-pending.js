const retry = require('oh-no-i-insist'),
	{ GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');
module.exports = function waitUntilNotPending(lambda, functionName, timeout, retries) {
	'use strict';
	return retry(
		() => {
			return lambda.send(new GetFunctionConfigurationCommand({FunctionName: functionName}))
				.then(result => {
					if (result.State === 'Failed') {
						throw `Lambda resource update failed`;
					}
					if (result.State === 'Pending') {
						throw 'Pending';
					}
					if (result.LastUpdateStatus === 'InProgress') {
						throw 'Pending';
					}
				});
		},
		timeout,
		retries,
		failure => failure === 'Pending',
		() => console.log('Lambda function is in Pending state, waiting...'),
		Promise
	);
};


