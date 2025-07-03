import { Stack, StackProps } from "aws-cdk-lib";
import { Runtime, Code, Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";

interface AwsLambdaFunctionStackProps extends StackProps {
    targetBucket: IBucket;  // Changed from targetBucketArn to IBucket for better integration
}

class AwsLambdaFunctionStack extends Stack {
    constructor(scope: Construct, id: string, props: AwsLambdaFunctionStackProps) {
        super(scope, id, props);

        const lambdaFunction = new LambdaFunction(this, 'LambdaFunction', {
            runtime: Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: Code.fromAsset('lambda'), // Ensure this path exists
            environment: {
                BUCKET_NAME: props.targetBucket.bucketArn, // Use bucket name instead of ARN
            },
        });

        // Grant the Lambda permissions to access the bucket
        props.targetBucket.grantReadWrite(lambdaFunction);
    }
}

export { AwsLambdaFunctionStack };