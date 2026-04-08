const loadConfig = require('../util/loadconfig'),
	parseKeyValueCSV = require('../util/parse-key-value-csv'),
	getOwnerInfo = require('../tasks/get-owner-info'),
	{ LambdaClient, GetFunctionConfigurationCommand, TagResourceCommand: LambdaTagResourceCommand } = require('@aws-sdk/client-lambda'),
	{ APIGatewayClient, TagResourceCommand: APIGWTagResourceCommand } = require('@aws-sdk/client-api-gateway'),
	awsClientConfig = require('../util/aws-client-config');

module.exports = function tag(options) {
	'use strict';
	let lambdaConfig,
		lambda,
		apiConfig,
		awsPartition,
		region,
		api;
	const initServices = function () {
			lambda = new LambdaClient(awsClientConfig(lambdaConfig.region, options));
			api = new APIGatewayClient(awsClientConfig(lambdaConfig.region, options));
		},
		getLambda = () => lambda.send(new GetFunctionConfigurationCommand({FunctionName: lambdaConfig.name, Qualifier: options.version})),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
					apiConfig = config.api;
					region = config.region;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				})
				.then(() => getOwnerInfo(region, undefined, options))
				.then(ownerInfo => {
					awsPartition = ownerInfo.partition;
				});
		},
		tagLambda = function (tags) {
			return lambda.send(new LambdaTagResourceCommand({
				Resource: lambdaConfig.arn,
				Tags: tags
			}));
		},
		tagApi = function (tags) {
			if (apiConfig && apiConfig.id) {
				return api.send(new APIGWTagResourceCommand({
					resourceArn: `arn:${awsPartition}:apigateway:${lambdaConfig.region}::/restapis/${apiConfig.id}`,
					tags: tags
				}));
			}
		},
		tag = function (tags) {
			return tagLambda(tags)
				.then(() => tagApi(tags));
		};
	if (!options.tags) {
		return Promise.reject('no tags specified. please provide them with --tags');
	}

	return readConfig()
		.then(() => tag(parseKeyValueCSV(options.tags)));
};

module.exports.doc = {
	description: 'Add tags (key-value pairs) to the lambda function and any associated web API',
	priority: 22,
	args: [
		{
			argument: 'tags',
			example: 'Team=onboarding,Project=amarillo',
			description: 'The list of tags (key-value pairs) to assign to the lambda function and any associated web API'
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
		}
	]
};
