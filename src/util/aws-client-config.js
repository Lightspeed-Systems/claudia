const { NodeHttpHandler } = require('@smithy/node-http-handler'),
	awsClientConfig = function awsClientConfig(region, options) {
		'use strict';
		const config = { region: region };
		if (options && options._credentials) {
			config.credentials = options._credentials;
		}
		if (options && options['aws-client-timeout']) {
			config.requestHandler = new NodeHttpHandler({
				requestTimeout: parseInt(options['aws-client-timeout'], 10)
			});
		}
		return config;
	};
module.exports = awsClientConfig;
