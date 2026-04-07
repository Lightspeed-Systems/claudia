const { DeleteRolePolicyCommand, DetachRolePolicyCommand, ListRolePoliciesCommand, ListAttachedRolePoliciesCommand, DeleteRoleCommand } = require('@aws-sdk/client-iam');
module.exports = function destroyRole(iam, roleName) {
	'use strict';
	const deleteSinglePolicy = function (policyName) {
			return iam.send(new DeleteRolePolicyCommand({
				PolicyName: policyName,
				RoleName: roleName
			}));
		},
		detachSinglePolicy = function (policy) {
			return iam.send(new DetachRolePolicyCommand({
				PolicyArn: policy.PolicyArn,
				RoleName: roleName
			}));
		};
	return iam.send(new ListRolePoliciesCommand({RoleName: roleName}))
	.then(result => Promise.all(result.PolicyNames.map(deleteSinglePolicy)))
	.then(() => iam.send(new ListAttachedRolePoliciesCommand({RoleName: roleName})))
	.then(result => Promise.all(result.AttachedPolicies.map(detachSinglePolicy)))
	.then(() => iam.send(new DeleteRoleCommand({RoleName: roleName})));
};
