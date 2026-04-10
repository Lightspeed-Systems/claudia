const { LambdaClient, DeleteFunctionCommand } = require('@aws-sdk/client-lambda'),
	{ CloudWatchLogsClient, DeleteLogGroupCommand } = require('@aws-sdk/client-cloudwatch-logs'),
	{ APIGatewayClient } = require('@aws-sdk/client-api-gateway'),
	apiGwCommands = require('@aws-sdk/client-api-gateway'),
	{ S3Client, DeleteObjectCommand, ListObjectsCommand, DeleteBucketCommand } = require('@aws-sdk/client-s3'),
	{ IoTClient, DeleteTopicRuleCommand } = require('@aws-sdk/client-iot'),
	{ SNSClient, DeleteTopicCommand } = require('@aws-sdk/client-sns'),
	{ SQSClient, DeleteQueueCommand } = require('@aws-sdk/client-sqs'),
	{ IAMClient } = require('@aws-sdk/client-iam'),
	{ CloudWatchEventsClient, ListTargetsByRuleCommand, RemoveTargetsCommand, DeleteRuleCommand } = require('@aws-sdk/client-cloudwatch-events'),
	{ CognitoIdentityProviderClient, DeleteUserPoolCommand } = require('@aws-sdk/client-cognito-identity-provider'),
	destroyRole = require('../../src/util/destroy-role'),
	fsUtil = require('../../src/util/fs-util'),
	retriableWrap = require('../../src/util/retriable-wrap'),
	awsRegion = require('./test-aws-region'),
	originalWorkingDir = process.cwd();

module.exports = function destroyObjects(newObjects) {
	'use strict';
	const lambda = new LambdaClient({ region: awsRegion }),
		logs = new CloudWatchLogsClient({ region: awsRegion }),
		apiGatewayPromise = retriableWrap(new APIGatewayClient({ region: awsRegion }), apiGwCommands),
		s3 = new S3Client({ region: awsRegion }),
		iot = new IoTClient({ region: awsRegion }),
		sns = new SNSClient({ region: awsRegion }),
		sqs = new SQSClient({ region: awsRegion }),
		iam = new IAMClient({ region: awsRegion }),
		events = new CloudWatchEventsClient({ region: awsRegion }),
		cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({ region: awsRegion }),
		destroyRule = function (ruleName) {
			return events.send(new ListTargetsByRuleCommand({ Rule: ruleName }))
			.then(config => {
				const ids = config.Targets.map(target => target.Id);
				if (ids.length) {
					return events.send(new RemoveTargetsCommand({ Rule: ruleName, Ids: ids }));
				}
			})
			.then(() => events.send(new DeleteRuleCommand({ Name: ruleName })));
		},
		destroyBucket = function (bucketName) {
			const deleteSingleObject = function (ob) {
				return s3.send(new DeleteObjectCommand({
					Bucket: bucketName,
					Key: ob.Key
				}));
			};
			return s3.send(new ListObjectsCommand({Bucket: bucketName}))
			.then(result => Promise.all(result.Contents.map(deleteSingleObject)))
			.then(() => s3.send(new DeleteBucketCommand({ Bucket: bucketName })));
		},
		removeRestApi = () => {
			if (newObjects.restApi) {
				return apiGatewayPromise.deleteRestApiPromise({
					restApiId: newObjects.restApi
				});
			}
		},
		removeIotRule = () => {
			if (newObjects.iotTopicRule) {
				return iot.send(new DeleteTopicRuleCommand({ruleName: newObjects.iotTopicRule}));
			}
		},
		removeLambdaFunction = () => {
			if (newObjects.lambdaFunction) {
				return lambda.send(new DeleteFunctionCommand({ FunctionName: newObjects.lambdaFunction }));
			}
		},
		removeLambdaLogs = () => {
			if (newObjects.lambdaFunction) {
				return logs.send(new DeleteLogGroupCommand({ logGroupName: '/aws/lambda/' + newObjects.lambdaFunction }))
				.catch(() => true);
			}
		},
		removeSnsTopic = () => {
			if (newObjects.snsTopic) {
				return sns.send(new DeleteTopicCommand({
					TopicArn: newObjects.snsTopic
				}));
			}
		},
		removeEventRule = () => {
			if (newObjects.eventRule) {
				return destroyRule(newObjects.eventRule);
			}
		},
		removeIamRole = () => {
			if (newObjects.lambdaRole) {
				return destroyRole(iam, newObjects.lambdaRole);
			}
		},
		removeCustomLogs = () => {
			if (newObjects.logGroup) {
				return logs.send(new DeleteLogGroupCommand({ logGroupName: newObjects.logGroup }));
			}
		},
		removeS3Bucket = () => {
			if (newObjects.s3Bucket) {
				return destroyBucket(newObjects.s3Bucket);
			}
		},
		removeCognitoPool = () => {
			if (newObjects.userPoolId) {
				return cognitoIdentityServiceProvider.send(new DeleteUserPoolCommand({ UserPoolId: newObjects.userPoolId }));
			}
		},
		removeSQSQueue = () => {
			if (newObjects.sqsQueueUrl) {
				return sqs.send(new DeleteQueueCommand({QueueUrl: newObjects.sqsQueueUrl}));
			}
		};



	if (!newObjects) {
		return Promise.resolve();
	}
	process.chdir(originalWorkingDir);
	if (newObjects.workingdir && fsUtil.isDir(newObjects.workingdir)) {
		fsUtil.rmDir(newObjects.workingdir);
	}

	return Promise.all([
		removeRestApi(),
		removeIotRule(),
		removeLambdaFunction(),
		removeLambdaLogs(),
		removeSnsTopic(),
		removeEventRule(),
		removeIamRole(),
		removeCustomLogs(),
		removeS3Bucket(),
		removeCognitoPool(),
		removeSQSQueue()
	]).catch(e => console.log('error cleaning up', e.stack || e.message || e));
};
