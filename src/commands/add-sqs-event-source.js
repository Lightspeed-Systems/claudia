const loadConfig = require('../util/loadconfig'),
	isSQSArn = require('../util/is-sqs-arn'),
	iamNameSanitize = require('../util/iam-name-sanitize'),
	retry = require('oh-no-i-insist'),
	{ LambdaClient, GetFunctionConfigurationCommand, CreateEventSourceMappingCommand } = require('@aws-sdk/client-lambda'),
	{ IAMClient, PutRolePolicyCommand } = require('@aws-sdk/client-iam'),
	{ SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs'),
	awsClientConfig = require('../util/aws-client-config');

module.exports = function addSQSEventSource(options, logger) {
	'use strict';
	let lambdaConfig,
		lambda,
		iam,
		sqs;
	const awsDelay = Number(options['aws-delay']) || 5000,
		awsRetries = Number(options['aws-retries']) || 15,
		initServices = function () {
			lambda = new LambdaClient(awsClientConfig(lambdaConfig.region, options));
			iam = new IAMClient(awsClientConfig(lambdaConfig.region, options));
			sqs = new SQSClient(awsClientConfig(lambdaConfig.region, options));
		},
		getLambda = () => lambda.send(new GetFunctionConfigurationCommand({FunctionName: lambdaConfig.name, Qualifier: options.version})),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		addSQSAccessPolicy = function (queueArn) {
			const policy = {
					Version: '2012-10-17',
					Statement: [
						{
							Effect: 'Allow',
							Action: [
								'sqs:DeleteMessage',
								'sqs:ChangeMessageVisibility',
								'sqs:ReceiveMessage',
								'sqs:GetQueueAttributes'
							],
							Resource: queueArn
						}
					]
				},
				ts = Date.now();
			return iam.send(new PutRolePolicyCommand({
				RoleName: lambdaConfig.role,
				PolicyName: iamNameSanitize(`sqs-access-${ts}`),
				PolicyDocument: JSON.stringify(policy)
			}))
			.then(() => queueArn);
		},
		getSQSArn = function () {
			if (isSQSArn(options.queue)) {
				return options.queue;
			} else {
				return sqs.send(new GetQueueUrlCommand({
					QueueName: options.queue
				}))
				.then(result => sqs.send(new GetQueueAttributesCommand({
					QueueUrl: result.QueueUrl,
					AttributeNames: ['QueueArn']
				})))
				.then(result => result.Attributes.QueueArn);
			}
		},
		addEventSource = function (sqsArn) {
			const params = {
				FunctionName: lambdaConfig.arn,
				EventSourceArn: sqsArn,
				BatchSize: options['batch-size']
			};
			return lambda.send(new CreateEventSourceMappingCommand(params));
		},
		retriableAddEventSource = function (sqsArn) {
			return retry(
				() => addEventSource(sqsArn),
				awsDelay,
				awsRetries,
				failure => failure.name === 'InvalidParameterValueException',
				() => {
					if (logger) {
						logger.logStage('waiting for IAM role propagation');
					}
				},
				Promise
			);
		};
	if (!options.queue) {
		return Promise.reject('SQS queue not specified. please provide it with --queue');
	}
	return readConfig()
		.then(getSQSArn)
		.then(addSQSAccessPolicy)
		.then(retriableAddEventSource);

};
module.exports.doc = {
	description: 'Set up SQS event triggers',
	priority: 5,
	args: [
		{
			argument: 'queue',
			description: 'SQS Queue name or ARN',
			example: 'analytics-events'
		},
		{
			argument: 'batch-size',
			optional: true,
			description: 'The batch size for the Lambda event source mapping',
			example: 2,
			default: 10
		},
		{
			argument: 'skip-iam',
			optional: true,
			description: 'Do not try to modify the IAM role for Lambda to allow SQS execution',
			example: 'true'
		},
		{
			argument: 'version',
			optional: true,
			description: 'Alias or numerical version of the lambda function to execute the trigger',
			example: 'production'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			default: 'current directory'
		},
		{
			argument: 'config',
			optional: true,
			description: 'Config file containing the resource names',
			default: 'claudia.json'
		},
		{
			argument: 'aws-delay',
			optional: true,
			example: '3000',
			description: 'number of milliseconds betweeen retrying AWS operations if they fail',
			default: '5000'
		},
		{
			argument: 'aws-retries',
			optional: true,
			example: '15',
			description: 'number of times to retry AWS operations if they fail',
			default: '15'
		}
	]
};

