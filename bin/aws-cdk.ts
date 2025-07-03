#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsS3Stack } from '../lib/aws-s3-stack';
import { AwsLambdaFunctionStack } from '../lib/aws-lambdafunction-stack';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = new cdk.App();

// Create S3 stack
const is_prod = (process.env.ENV === 'prod' || process.env.ENV === 'production')? true : false;
const s3Stack = new AwsS3Stack(app, 'S3Stack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: process.env.CDK_DEFAULT_REGION 
    },},
    is_prod 
 );

// Create Lambda stack that depends on the S3 bucket
new AwsLambdaFunctionStack(app, 'LambdaStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    },
    targetBucket: s3Stack.targetBucket // Pass the bucket object directly
});