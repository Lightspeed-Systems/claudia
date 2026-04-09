/*
 * Unit test runner — runs only specs that do not require AWS credentials.
 *
 * The full test suite (jasmine-runner.js / `npm test`) includes integration
 * tests that create real AWS resources (Lambda, API Gateway, IAM, etc.) and
 * need valid credentials + permissions. This runner explicitly lists only the
 * pure-logic unit specs so they can be executed in environments without AWS
 * access, such as local development or CI pipelines that lack an AWS account.
 *
 * Usage:  npm run test:unit
 *
 * When adding a new spec that does NOT hit AWS services, add it to the
 * spec_files list below so it is included in the unit test run.
 */
const Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	jrunner = new Jasmine();

'use strict';

jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
	displayStacktrace: 'all'
}));

jrunner.loadConfig({
	'spec_dir': 'spec',
	'spec_files': [
		'retriable-wrap-spec.js',
		'list-wrappable-functions-spec.js',
		'count-elements-spec.js',
		'array-logger-spec.js',
		'null-logger-spec.js',
		'console-logger-spec.js',
		'fs-promise-spec.js',
		'fs-util-spec.js',
		'iam-name-sanitize-spec.js',
		'lambda-name-sanitize-spec.js',
		'is-role-arn-spec.js',
		'is-sns-arn-spec.js',
		'is-sqs-arn-spec.js',
		'is-kinesis-arn-spec.js',
		'merge-properties-spec.js',
		'parse-key-value-csv-spec.js',
		'flatten-request-parameters-spec.js',
		'expected-archive-name-spec.js',
		'loadconfig-spec.js',
		'init-env-vars-from-options-spec.js',
		'extract-aliases-spec.js',
		'clean-up-package-spec.js',
		'patch-escape-spec.js',
		'create-patch-array-for-types-spec.js',
		'find-cloudfront-behavior-spec.js',
		'append-service-to-role-spec.js',
		'pack-project-to-tar-spec.js',
		'extract-tar-spec.js'
	],
	'helpers': []
});

jrunner.onComplete(function (passed) {
	'use strict';
	process.exit(passed ? 0 : 1);
});

jrunner.execute();
