const { UpdateAliasCommand, CreateAliasCommand } = require('@aws-sdk/client-lambda');
module.exports = function markAlias(functionName, lambda, versionName, versionAlias) {
	'use strict';
	const config = {
		FunctionName: functionName,
		FunctionVersion: versionName,
		Name: versionAlias
	};
	return lambda.send(new UpdateAliasCommand(config))
	.catch(e => {
		if (e && e.name === 'ResourceNotFoundException') {
			return lambda.send(new CreateAliasCommand(config));
		} else {
			return Promise.reject(e);
		}
	});
};
