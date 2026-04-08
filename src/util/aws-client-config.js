let sharedCredentials;
const awsClientConfig = function awsClientConfig(region, options) {
	'use strict';
	const config = { region: region };
	if (options && options._credentials) {
		sharedCredentials = options._credentials;
	}
	if (sharedCredentials) {
		config.credentials = sharedCredentials;
	}
	if (options && options['aws-client-timeout']) {
		config.requestHandler = {
			requestTimeout: parseInt(options['aws-client-timeout'], 10)
		};
	}
	return config;
};
awsClientConfig.reset = function () {
	'use strict';
	sharedCredentials = undefined;
};
module.exports = awsClientConfig;
