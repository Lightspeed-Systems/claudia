const loadConfig = require('../util/loadconfig'),
	NullLogger = require('../util/null-logger'),
	loggingWrap = require('../util/logging-wrap'),
	appendServiceToRole = require('../tasks/append-service-to-role'),
	retry = require('oh-no-i-insist'),
	findCloudfrontBehavior = require('../tasks/find-cloudfront-behavior'),
	patchLambdaFunctionAssociations = require('../tasks/patch-lambda-function-associations'),
	{ LambdaClient, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda'),
	{ IAMClient, GetRoleCommand, UpdateAssumeRolePolicyCommand } = require('@aws-sdk/client-iam'),
	{ CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } = require('@aws-sdk/client-cloudfront'),
	awsClientConfig = require('../util/aws-client-config');

module.exports = function setCloudFrontTrigger(options, optionalLogger) {
	'use strict';
	let lambdaConfig,
		iam,
		cloudFront,
		lambda;
	const awsDelay = Number(options['aws-delay']) || 5000,
		awsRetries = Number(options['aws-retries']) || 15,
		logger = optionalLogger || new NullLogger(),
		pathPattern = options['path-pattern'],
		distributionId = options['distribution-id'],
		printVersionWarning = function () {
			const color = 3,
				text = `
********************
CloudFront triggers are associated with a numerical configuration version, and do not upgrade automatically.
You will need to call this command again after updating the Lambda function (even if using an alias)
to propagate changes to Lambda@Edge.
********************
`;
			console.log(`\x1b[3${color}m${text}\x1b[0m`);
		},
		initServices = function (config) {
			lambda = loggingWrap(new LambdaClient(awsClientConfig(config.region, options)), {log: logger.logApiCall, logName: 'lambda'});
			iam = loggingWrap(new IAMClient(awsClientConfig(config.region, options)), {log: logger.logApiCall, logName: 'iam'});
			cloudFront = loggingWrap(new CloudFrontClient(awsClientConfig(config.region, options)), {log: logger.logApiCall, logName: 'cloudfront'});
		},
		readConfig = function () {
			const version = String(options.version);
			return loadConfig(options, {lambda: {name: true, region: true, role: true}})
				.then(config => lambdaConfig = config.lambda)
				.then(initServices)
				.then(() => lambda.send(new GetFunctionConfigurationCommand({FunctionName: lambdaConfig.name, Qualifier: version})))
				.then(result => {
					if (result.Version === version) {
						return result;
					}
					return lambda.send(new GetFunctionConfigurationCommand({FunctionName: lambdaConfig.name, Qualifier: result.Version}));
				})
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		upgradeAssumeRolePolicy = function () {
			return iam.send(new GetRoleCommand({RoleName: lambdaConfig.role}))
				.then(result => {
					const policyDocument = unescape((result.Role.AssumeRolePolicyDocument)),
						upgradedPolicyDocument = appendServiceToRole(policyDocument, 'edgelambda.amazonaws.com');
					if (policyDocument !== upgradedPolicyDocument) {
						return iam.send(new UpdateAssumeRolePolicyCommand({RoleName: lambdaConfig.role, PolicyDocument: upgradedPolicyDocument}));
					}
				});
		},
		setEventTriggers = function () {
			return cloudFront.send(new GetDistributionConfigCommand({
				Id: distributionId
			}))
			.then(result => {
				const config = result.DistributionConfig,
					etag = result.ETag,
					behavior = findCloudfrontBehavior(config, pathPattern);
				if (!behavior) {
					throw `Distribution ${distributionId} does not contain a behavior matching path pattern ${pathPattern}`;
				}
				patchLambdaFunctionAssociations(behavior.LambdaFunctionAssociations, options['event-types'].split(','), lambdaConfig.arn);
				return retry(
					() => {
						return cloudFront.send(new UpdateDistributionCommand({
							Id: distributionId,
							DistributionConfig: config,
							IfMatch: etag
						}));
					},
					awsDelay,
					awsRetries,
					failure => failure.name === 'InvalidLambdaFunctionAssociation',
					() => {},
					Promise
				);
			});
		},
		formatResult = function (r) {
			const config = r.Distribution.DistributionConfig,
				behavior = findCloudfrontBehavior(config, pathPattern);
			return behavior.LambdaFunctionAssociations;
		};
	if (!distributionId) {
		return Promise.reject('Cloudfront Distribution ID is not specified. please provide it with --distribution-id');
	}
	if (!options.version) {
		return Promise.reject('Lambda@Edge requires a fixed version. please provide a numeric version or an alias with --version');
	}
	if (!options['event-types']) {
		return Promise.reject('Event types must be specified, please provide them with --event-types (comma separated)');
	}

	if (!options.quiet) {
		printVersionWarning();
	}
	return readConfig()
		.then(upgradeAssumeRolePolicy)
		.then(setEventTriggers)
		.then(formatResult);
};
module.exports.doc = {
	description: 'Set up Lambda@Edge CloudFront behavior event triggers',
	priority: 5,
	args: [
		{
			argument: 'distribution-id',
			description: 'CloudFront distribution ID',
			example: 'E17XW3PXPSO9'
		},
		{
			argument: 'event-types',
			description: 'Comma-separated list of trigger event types. See http://docs.aws.amazon.com/cloudfront/latest/APIReference/API_LambdaFunctionAssociation.html for valid values',
			example: 'viewer-request,origin-response'
		},
		{
			argument: 'version',
			optional: false,
			description: 'Alias or numerical version of the lambda function to execute the trigger',
			example: 'production'
		},
		{
			argument: 'path-pattern',
			optional: true,
			description: 'The path pattern matching the distribution cache behavior you want to change',
			default: 'change is applied to the default distribution cache behavior',
			example: '/dev'
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

