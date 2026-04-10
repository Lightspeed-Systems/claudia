const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs'),
	sqs = new SQSClient();
exports.handler = function (event, context) {
	'use strict';
	return sqs.send(new SendMessageCommand({
		QueueUrl: process.env.QUEUE_URL,
		MessageBody: JSON.stringify({ received: event, invokedFunctionArn: context.invokedFunctionArn})
	}));
};
