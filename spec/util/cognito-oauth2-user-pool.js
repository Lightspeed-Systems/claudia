
const { CognitoIdentityProviderClient, CreateUserPoolCommand, CreateUserPoolClientCommand, DeleteUserPoolCommand } = require('@aws-sdk/client-cognito-identity-provider'),
	awsRegion = require('./test-aws-region'),
	getOwnerInfo = require('../../src/tasks/get-owner-info'),
	userPoolName = 'test-user-pool-' + Date.now();

let userPoolId, userPoolArn, idToken;

module.exports.create = function create() {
	'use strict';
	const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({ region: awsRegion });
	return cognitoIdentityServiceProvider.send(new CreateUserPoolCommand({
		PoolName: userPoolName,
		Schema: [
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'name',
				'Required': true
			},
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'email',
				'Required': true
			},
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'preferred_username',
				'Required': true
			}
		]
	}))
	.then(result => {
		userPoolId = result.UserPool.Id;
	})
	.then(getOwnerInfo)
	.then(owner => {
		userPoolArn = `arn:${owner.partition}:cognito-idp:${awsRegion}:${owner.account}:userpool/${userPoolId}`;
	})
	.then(() => {
		const params = {
			ClientName: 'TestClient',
			UserPoolId: userPoolId,
			GenerateSecret: false,
			ExplicitAuthFlows: ['ADMIN_NO_SRP_AUTH'],
			AllowedOAuthScopes: ['email', 'openid'],
			AllowedOAuthFlows: ['code'],
			AllowedOAuthFlowsUserPoolClient: true,
			CallbackURLs: ['http://localhost:3000'],
			SupportedIdentityProviders: ['COGNITO']

		};
		return cognitoIdentityServiceProvider.send(new CreateUserPoolClientCommand(params));
	});
};

module.exports.destroy = function () {
	'use strict';
	if (userPoolId) {
		const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({ region: awsRegion });
		return cognitoIdentityServiceProvider.send(new DeleteUserPoolCommand({ UserPoolId: userPoolId }));
	}
};

module.exports.getArn = function () {
	'use strict';
	if (!userPoolArn) {
		throw 'Cognito User Pool Not Created!';
	}
	return userPoolArn;
};

module.exports.getUserToken = function () {
	'use strict';
	if (!idToken) {
		throw 'Cognito User Pool Not Created!';
	}
	return idToken;
};
