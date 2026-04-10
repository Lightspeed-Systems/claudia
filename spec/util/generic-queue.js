
let queueUrl;
const { SQSClient, CreateQueueCommand, ReceiveMessageCommand, DeleteMessageCommand, DeleteQueueCommand } = require('@aws-sdk/client-sqs'),
	awsRegion = require('./test-aws-region'),
	sqs = new SQSClient({region: awsRegion}),
	retry = require('oh-no-i-insist'),
	genericQueueName = 'test-queue-' + Date.now(),
	getQueueUrl = function () {
		'use strict';
		if (queueUrl) {
			return Promise.resolve(queueUrl);
		} else {
			return sqs.send(new CreateQueueCommand({
				QueueName: genericQueueName
			}))
			.then(result => {
				queueUrl = result.QueueUrl;
				return queueUrl;
			});
		}
	};


module.exports.getQueueUrl = getQueueUrl;
module.exports.waitForMessage = function (contents) {
	'use strict';
	return getQueueUrl()
		.then(queueUrl => {
			return retry(() => {
				return sqs.send(new ReceiveMessageCommand({
					QueueUrl: queueUrl,
					MaxNumberOfMessages: 1,
					WaitTimeSeconds: 5
				})).then(response => {
					const match = response && response.Messages &&
						response.Messages.find(message => message.Body.indexOf(contents) > -1);
					if (match) {
						return sqs.send(new DeleteMessageCommand({
							QueueUrl: queueUrl,
							ReceiptHandle: match.ReceiptHandle
						}))
						.then(() => Promise.resolve(match));
					}
					return Promise.reject('message not received');
				});
			}, 500, 10, undefined, undefined, Promise);
		});

};
module.exports.destroy = function () {
	'use strict';
	if (!queueUrl) {
		return Promise.resolve();
	} else {
		return sqs.send(new DeleteQueueCommand({QueueUrl: queueUrl}));
	}
};
