const { CognitoIdentityProviderClient, CreateUserPoolCommand, CreateUserPoolClientCommand, SignUpCommand, AdminConfirmSignUpCommand, AdminInitiateAuthCommand, DeleteUserPoolCommand } = require('@aws-sdk/client-cognito-identity-provider'),
	awsRegion = require('./test-aws-region'),
	getOwnerInfo = require('../../src/tasks/get-owner-info'),
	userPoolName = 'test-user-pool-' + Date.now();

let userPoolId, clientId, userPoolArn, idToken;

module.exports.create = function create() {
	'use strict';
	const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({ region: awsRegion });
	return cognitoIdentityServiceProvider.send(new CreateUserPoolCommand({ PoolName: userPoolName }))
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
			ExplicitAuthFlows: ['ADMIN_NO_SRP_AUTH']
		};
		return cognitoIdentityServiceProvider.send(new CreateUserPoolClientCommand(params));
	})
	.then(result => {
		clientId = result.UserPoolClient.ClientId;
	})
	.then(() => {
		const params = {
			ClientId: clientId,
			Username: 'Bob-123',
			Password: 'Password1!'
		};
		return cognitoIdentityServiceProvider.send(new SignUpCommand(params));
	})
	.then(() => {
		const params = {
			UserPoolId: userPoolId,
			Username: 'Bob-123'
		};
		return cognitoIdentityServiceProvider.send(new AdminConfirmSignUpCommand(params));
	})
	.then(() => {
		const params = {
			ClientId: clientId,
			UserPoolId: userPoolId,
			AuthFlow: 'ADMIN_NO_SRP_AUTH',
			AuthParameters: {
				USERNAME: 'Bob-123',
				PASSWORD: 'Password1!'
			}
		};
		return cognitoIdentityServiceProvider.send(new AdminInitiateAuthCommand(params));
	})
	.then(result => {
		idToken = result.AuthenticationResult.IdToken;
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
