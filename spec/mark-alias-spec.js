const underTest = require('../src/tasks/mark-alias'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	update = require('../src/commands/update'),
	tmppath = require('../src/util/tmppath'),
	fsUtil = require('../src/util/fs-util'),
	fs = require('fs'),
	{ LambdaClient, GetAliasCommand, CreateAliasCommand } = require('@aws-sdk/client-lambda'),
	awsRegion = require('./util/test-aws-region');
describe('markAlias', () => {
	'use strict';
	let workingdir, testRunName, lambda, newObjects;
	beforeEach(() => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = new LambdaClient({ region: awsRegion });
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects)
		.then(done, done.fail);
	});
	describe('when the lambda project exists', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(done, done.fail);
		});
		it('creates a new version alias of the lambda function', done => {
			underTest(testRunName, lambda, '1', 'testver')
			.then(() => lambda.send(new GetAliasCommand({ FunctionName: testRunName, Name: 'testver' })))
			.then(result => expect(result.FunctionVersion).toEqual('1'))
			.then(done, done.fail);
		});
		it('migrates an alias if it already exists', done => {
			fsUtil.copy('spec/test-projects/echo', workingdir, true);
			lambda.send(new CreateAliasCommand({
				FunctionName: testRunName,
				FunctionVersion: '1',
				Name: 'dev'
			}))
			.then(() => update({ source: workingdir }))
			.then(() => underTest(testRunName, lambda, '2', 'testver'))
			.then(() => lambda.send(new GetAliasCommand({ FunctionName: testRunName, Name: 'testver' })))
			.then(result => expect(result.FunctionVersion).toEqual('2'))
			.then(done, done.fail);
		});
	});
});
