const retry = require('oh-no-i-insist'),
	{ CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

module.exports = function pollForLogEvents(logGroup, filterPattern, awsRegion) {
	'use strict';
	const logs = new CloudWatchLogsClient({ region: awsRegion }),
		retryTimeout = process.env.AWS_DEPLOY_TIMEOUT || 10000,
		retries = process.env.AWS_DEPLOY_RETRIES || 5,
		checkForMatchingEvents = function (logEvents) {
			if (logEvents.events.length) {
				return logEvents.events;
			} else {
				return Promise.reject();
			}
		};

	return retry(() => {
		return logs.send(new FilterLogEventsCommand({ logGroupName: logGroup, filterPattern: filterPattern}))
		.then(checkForMatchingEvents);
	}, retryTimeout, retries, undefined, undefined, Promise);
};
