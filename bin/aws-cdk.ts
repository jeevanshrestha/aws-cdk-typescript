#!/usr/bin/env node  
import * as cdk from 'aws-cdk-lib';
import { VPCStack } from '../lib/aws-vpc-stack';
import { EC2Stack } from '../lib/aws-ec2-stack';
import { AlbStack } from '../lib/aws-alb-stack';
import { JumpboxStack } from '../lib/aws-jumbpox-eip-stack';
import { AwsS3Stack } from '../lib/aws-s3-stack';
import { AwsLambdaFunctionStack } from '../lib/aws-lambdafunction-stack';
import { vars } from '../config/vars';
import { RdsDynamoDbStack } from '../lib/aws-rds-dynomodb-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EksStack } from '../lib/eks-stack';

const app = new cdk.App();

// Environment configuration
type EnvName = keyof typeof vars.environments;
const envName: EnvName = 'dev';
const envConfig = vars.environments[envName];

if (!envConfig) {
  throw new Error(`Environment configuration not found for: ${envName}`);
}

 
// Common environment configuration for all stacks
const stackEnv = {
  account: envConfig.account || '480926032159' ,
  region: envConfig.region  || 'ap-southeast-2', // Default to 'ap-southeast-2' if not specified,
};
 

// =====================
// Stacks Deployment
// =====================

// Networking Layer
const vpcStack = new VPCStack(app, `Jeeves-VpcStack`, {
  envName,
  envConfig,
  env: stackEnv,
  description: `${vars.projectName} VPC Stack (${envName})`,
});

// Compute Layer
const jumpboxStack = new JumpboxStack(app, `Jeeves-JumpboxStack`, {
  envName,
  envConfig,
  env: stackEnv,
  vpc: vpcStack.vpc,
  jumpboxSecurityGroup: vpcStack.jumpboxSecurityGroup,
  description: `${vars.projectName} Jumpbox Stack (${envName})`,
});

const ec2Stack = new EC2Stack(app, `Jeeves-Ec2Stack`, {
  envName,
  envConfig,
  env: stackEnv,
  vpc: vpcStack.vpc,
  webSecurityGroup: vpcStack.webSecurityGroup,
  dbSecurityGroup: vpcStack.dbSecurityGroup,
  description: `${vars.projectName} EC2 Stack (${envName})`,
});

// Load Balancing Layer
const albStack = new AlbStack(app, `Jeeves-AlbStack`, {
  envName,
  envConfig,
  env: stackEnv,
  vpc: vpcStack.vpc,
  albSecurityGroup: vpcStack.albSecurityGroup,
  webInstances: ec2Stack.webInstances,
  description: `${vars.projectName} ALB Stack (${envName})`,
});

// =====================
// CloudFormation Outputs
// =====================
const outputPrefix = `Jeeves-${envName}`;  // Removed leading space

new cdk.CfnOutput(vpcStack, 'VpcId', {
  value: vpcStack.vpc.vpcId,
  description: 'VPC ID',
  exportName: `${outputPrefix}-vpc-id`,
});

new cdk.CfnOutput(jumpboxStack, 'JumpboxPublicIp', {
  value: jumpboxStack.jumpboxEip.ref,
  description: 'Jumpbox Public IP Address',
  exportName: `${outputPrefix}-jumpbox-ip`,
});

new cdk.CfnOutput(albStack, 'AlbEndpoint', {
  value: `http://${albStack.alb.loadBalancerDnsName}`,
  description: 'ALB Public Endpoint',
  exportName: `${outputPrefix}-alb-endpoint`,
});

new cdk.CfnOutput(ec2Stack, 'WebInstanceIds', {
  value: ec2Stack.webInstances.map(instance => instance.instanceId).join(','),
  description: 'Web Server Instance IDs',
  exportName: `${outputPrefix}-web-instance-ids`,
});
 
// Create S3 stack 
const s3Stack = new AwsS3Stack(app, 'S3Stack', {
    env: stackEnv
});

// Create Lambda stack that depends on the S3 bucket
const lambdaStack = new AwsLambdaFunctionStack(app, 'LambdaStack', {
    env: stackEnv,
    targetBucket: s3Stack.targetBucket
});

lambdaStack.addDependency(s3Stack);



// Cross-stack outputs with underscore-separated names
new cdk.CfnOutput(s3Stack, 'S3BucketExport', {
    value: s3Stack.targetBucket.bucketName,
    description: 'S3 Bucket Name',
    exportName: `${outputPrefix}-${envName}-S3BucketName`  // Using underscores
});

new cdk.CfnOutput(lambdaStack, 'LambdaArnExport', {
    value: lambdaStack.lambdaFunction.functionArn,
    description: 'Lambda Function ARN',
    exportName: `${outputPrefix}-${envName}-LambdaArn`  // Using underscores
});

// Create the RDS and DynamoDB stack with explicit dependencies
const rdsDynamoDbStack = new RdsDynamoDbStack(app, 'RdsDynamoDbStack', {
  envName,
  envConfig,
  env: stackEnv,
  vpc: vpcStack.vpc,
  dbSecurityGroup: vpcStack.dbSecurityGroup,
  rdsInstanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
  databaseName: 'jeeves_db',
  dynamoTableName: 'jeeves_data',
  dynamoBillingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Use PAY_PER_REQUEST for  
});

// Explicit dependency declaration
rdsDynamoDbStack.addDependency(vpcStack);

// Output important endpoints for other stacks
new cdk.CfnOutput(rdsDynamoDbStack, 'RdsEndpointOutput', {
  value: rdsDynamoDbStack.rdsInstance.dbInstanceEndpointAddress,
  description: 'RDS Instance Endpoint',
  exportName: `Jeeves${envName}RdsEndpoint`.replace(/-/g, ''),
});

new cdk.CfnOutput(rdsDynamoDbStack, 'DynamoTableArnOutput', {
  value: rdsDynamoDbStack.dynamoTable.tableArn,
  description: 'DynamoDB Table ARN',
  exportName: `Jeeves${envName}DynamoArn`.replace(/-/g, ''),
});


// Create EKS Stack that depends on VPC
const eksStack = new EksStack(app, 'EksStack', {
  envName,
  envConfig,
  env: stackEnv,
  vpc: vpcStack.vpc, 
  instanceType: new ec2.InstanceType('t3.medium'), // Optional override
});


// Add outputs
new cdk.CfnOutput(eksStack, 'ClusterName', {
  value: eksStack.cluster.clusterName,
  description: 'The name of the EKS cluster',
  exportName: `${envName}-eks-cluster-name`,
});

new cdk.CfnOutput(eksStack, 'ClusterEndpoint', {
  value: eksStack.cluster.clusterEndpoint,
  description: 'The endpoint URL for the EKS cluster',
  exportName: `${envName}-eks-cluster-endpoint`,
});

new cdk.CfnOutput(eksStack, 'ClusterSecurityGroupId', {
  value: eksStack.cluster.clusterSecurityGroupId,
  description: 'The security group ID for the EKS cluster',
  exportName: `${envName}-eks-cluster-sg-id`,
});

new cdk.CfnOutput(eksStack, 'NodeGroupName', {
  value: eksStack.nodeGroup.nodegroupName,
  description: 'The name of the EKS node group',
  exportName: `${envName}-eks-nodegroup-name`,
});

new cdk.CfnOutput(eksStack, 'KubeConfigCommand', {
  value: `aws eks update-kubeconfig --name ${eksStack.cluster.clusterName} --region ${envConfig.region}`,
  description: 'Command to configure kubectl access to the cluster',
});

new cdk.CfnOutput(eksStack, 'EbsCsiDriverServiceAccount', {
  value: eksStack.ebsCsiDriverServiceAccount.serviceAccountName,
  description: 'The service account name for EBS CSI driver',
  exportName: `${envName}-ebs-csi-service-account`,
});



// =====================
// Dependencies
// =====================
jumpboxStack.addDependency(vpcStack);
ec2Stack.addDependency(vpcStack);
albStack.addDependency(ec2Stack);
eksStack.addDependency(vpcStack);
// =====================
// Tagging
// =====================
Object.entries(envConfig.tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});
