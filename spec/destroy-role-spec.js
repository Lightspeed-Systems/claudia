const underTest = require('../src/util/destroy-role'),
	{ IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand, ListRolePoliciesCommand, AttachRolePolicyCommand } = require('@aws-sdk/client-iam'),
	awsRegion = require('./util/test-aws-region'),
	executorPolicy = require('../src/policies/lambda-executor-policy'),
	loggingPolicy = require('../src/policies/logging-policy');
describe('destroyRole', () => {
	'use strict';
	let testRunName, iam;
	beforeEach(done => {
		testRunName = `test${Date.now()}-executor`;
		iam = new IAMClient({region: awsRegion});

		iam.send(new CreateRoleCommand({
			RoleName: testRunName,
			AssumeRolePolicyDocument: executorPolicy()
		}))
		.then(() => iam.send(new PutRolePolicyCommand({
			RoleName: testRunName,
			PolicyName: 'log-writer',
			PolicyDocument: loggingPolicy('aws')
		})))
		.then(done, done.fail);
	});
	it('destroys the role', done => {
		underTest(iam, testRunName)
		.then(() => iam.send(new GetRoleCommand({ RoleName: testRunName })))
		.catch(expectedException => expect(expectedException.name).toEqual('NoSuchEntityException'))
		.then(done, done.fail);
	});
	it('destroys the policies', done => {
		underTest(iam, testRunName)
		.then(() => iam.send(new ListRolePoliciesCommand({ RoleName: testRunName })))
		.catch(expectedException => expect(expectedException.message).toContain(testRunName))
		.then(done, done.fail);
	});
	it('destroys a role with attached policies', done => {
		iam.send(new AttachRolePolicyCommand({
			RoleName: testRunName,
			PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole'
		}))
		.then(() => underTest(iam, testRunName))
		.then(() => iam.send(new GetRoleCommand({ RoleName: testRunName })))
		.catch(expectedException => expect(expectedException.name).toEqual('NoSuchEntityException'))
		.then(done, done.fail);
	});
});
