const { CloudWatchLogsClient, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
exports.handler = function (event, context) {
	'use strict';
	const logs = new CloudWatchLogsClient({ region: event.region });
	logs.send(new PutLogEventsCommand({logStreamName: event.stream, logGroupName: event.group,
		logEvents: [{ message: event.message, timestamp: Date.now()}]}))
	.then(result => context.done(null, result))
	.catch(err => context.done(err));
};
