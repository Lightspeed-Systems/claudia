const underTest = require('../src/commands/add-sns-event-source'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	retry = require('oh-no-i-insist'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path'),
	{ CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs'),
	{ LambdaClient, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda'),
	{ SNSClient, CreateTopicCommand, ListSubscriptionsByTopicCommand, GetSubscriptionAttributesCommand, PublishCommand } = require('@aws-sdk/client-sns'),
	awsRegion = require('./util/test-aws-region');
describe('addSNSEventSource', () => {
	'use strict';
	let workingdir, testRunName, newObjects, config, logs, lambda, sns;
	beforeEach(() => {
		workingdir = tmppath();
		logs = new CloudWatchLogsClient({ region: awsRegion });
		lambda = new LambdaClient({ region: awsRegion });
		sns = new SNSClient({ region: awsRegion });
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
		config = {
			topic: 'test-topic',
			source: workingdir
		};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the topic is not defined in options', done => {
		config.topic = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('SNS topic not specified. please provide it with --topic');
			done();
		});
	});
	it('fails when both filter-policy and filter-policy-file are set', done => {
		config['filter-policy'] = '{}';
		config['filter-policy-file'] = 'x.json';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('Cannot use both filter-policy and filter-policy-file. Specify only one.');
			done();
		});
	});

	it('fails when the source dir does not contain the project config file', done => {
		underTest(config).then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({ lambda: { name: 'xxx' } }), 'utf8');
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});

	describe('when params are valid', () => {
		let createConfig;
		const createLambda = function () {
			return create(createConfig)
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			});
		};
		beforeEach(done => {
			createConfig = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			sns.send(new CreateTopicCommand({
				Name: `${testRunName}-topic`
			}))
			.then(result => {
				newObjects.snsTopic = result.TopicArn;
				config.topic = result.TopicArn;
			})
			.then(done);
		});
		it('sets up privileges and rule notifications if no version given', done => {
			let functionArn;
			createLambda()
			.then(() => {
				return lambda.send(new GetFunctionConfigurationCommand({
					FunctionName: testRunName
				}));
			})
			.then(lambdaResult => {
				functionArn = lambdaResult.FunctionArn;
			})
			.then(() => underTest(config))
			.then(() => sns.send(new ListSubscriptionsByTopicCommand({TopicArn: config.topic})))
			.then(config => {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			})
			.then(done, done.fail);
		});
		it('does not add a filter policy if not requested', done =>	{
			createLambda()
			.then(() => underTest(config))
			.then(() => sns.send(new ListSubscriptionsByTopicCommand({TopicArn: config.topic})))
			.then(result => sns.send(new GetSubscriptionAttributesCommand({SubscriptionArn: result.Subscriptions[0].SubscriptionArn})))
			.then(attr => {
				expect(attr.Attributes.FilterPolicy).toBeFalsy();
			})
			.then(done, done.fail);
		});

		it('adds a filter policy if requested', done =>	{
			const policy = {
				provider: ['some-provider']
			};
			config['filter-policy'] = JSON.stringify(policy);
			createLambda()
			.then(() => underTest(config))
			.then(() => sns.send(new ListSubscriptionsByTopicCommand({TopicArn: config.topic})))
			.then(result => sns.send(new GetSubscriptionAttributesCommand({SubscriptionArn: result.Subscriptions[0].SubscriptionArn})))
			.then(attr => {
				expect(JSON.parse(attr.Attributes.FilterPolicy)).toEqual(policy);
			})
			.then(done, done.fail);
		});
		it('adds a filter policy from a file if requested', done =>	{
			const policy = {
					provider: ['some-provider']
				},
				policyFile = path.join(workingdir, 'sns-policy.json');
			fs.writeFileSync(policyFile, JSON.stringify(policy), 'utf8');
			config['filter-policy-file'] = policyFile;
			createLambda()
			.then(() => underTest(config))
			.then(() => sns.send(new ListSubscriptionsByTopicCommand({TopicArn: config.topic})))
			.then(result => sns.send(new GetSubscriptionAttributesCommand({SubscriptionArn: result.Subscriptions[0].SubscriptionArn})))
			.then(attr => {
				expect(JSON.parse(attr.Attributes.FilterPolicy)).toEqual(policy);
			})
			.then(done, done.fail);
		});
		it('invokes lambda from SNS when no version is given', done => {
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return sns.send(new PublishCommand({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}));
			})
			.then(() => {
				return retry(() => {
					console.log(`trying to get events from /aws/lambda/${testRunName}`);
					return logs.send(new FilterLogEventsCommand({ logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription' }))
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5, undefined, undefined, Promise);
			})
			.then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', done => {
			let functionArn;
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(() => {
				return lambda.send(new GetFunctionConfigurationCommand({
					FunctionName: testRunName,
					Qualifier: 'special'
				}));
			})
			.then(lambdaResult => {
				functionArn = lambdaResult.FunctionArn;
			})
			.then(() => underTest(config))
			.then(() => sns.send(new ListSubscriptionsByTopicCommand({TopicArn: config.topic})))
			.then(config => {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			})
			.then(done, done.fail);
		});
		it('invokes lambda from SNS when version is provided', done => {
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return sns.send(new PublishCommand({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}));
			})
			.then(() => {
				return retry(() => {
					console.log('trying to get events from ' + '/aws/lambda/' + testRunName);
					return logs.send(new FilterLogEventsCommand({logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription'}))
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5);
			})
			.then(done, done.fail);
		});
	});
});
