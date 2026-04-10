const fsPromise = require('../util/fs-promise'),
	{ PutRolePolicyCommand } = require('@aws-sdk/client-iam');
module.exports = function addPolicy(iam, policyName, roleName, fileName) {
	'use strict';
	return fsPromise.readFileAsync(fileName, 'utf8')
		.then(policyContents => iam.send(new PutRolePolicyCommand({
			RoleName: roleName,
			PolicyName: policyName,
			PolicyDocument: policyContents
		})));
};
