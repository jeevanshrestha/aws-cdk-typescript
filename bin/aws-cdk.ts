#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
//import { AwsCdkStack } from '../lib/aws-cdk-stack';
import { AwsS3Stack  } from '../lib/aws-s3-stack';
import {AwsLambdaFunctionStack} from '../lib/aws-lambdafunction-stack'
const app = new cdk.App();
const is_prod = false;

const s3Stack = new AwsS3Stack(app, 'AwsS3Stack', {}, is_prod);
const lambdaStack = new AwsLambdaFunctionStack(app, 'AwsLambdaFunctionStack',{targetBucketArn: s3Stack.BucketArn} );

// Make Lambda stack depend on S3 stack
lambdaStack.addDependency(s3Stack);

// new AwsCdkStack(app, 'AwsCdkStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '123456789012', region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });