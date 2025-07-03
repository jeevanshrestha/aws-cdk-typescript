import { Stack, StackProps, Duration, CfnOutput }  from "aws-cdk-lib";
import { Runtime, Code, Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as path from 'path';
interface AwsLambdaFunctionStackProps extends StackProps {
    targetBucket: IBucket;
    functionName?: string;
    memorySize?: number;
    timeout?: Duration;
}

class AwsLambdaFunctionStack extends Stack {
    public readonly lambdaFunction: LambdaFunction;
    
    constructor(scope: Construct, id: string, props: AwsLambdaFunctionStackProps) {
        super(scope, id, props);

        // Validate Lambda code path exists
        const lambdaCodePath = path.join(__dirname, '../lambda');
        try {
            require.resolve(`${lambdaCodePath}/index.js`);
        } catch (e) {
            throw new Error(`Lambda code not found at path: ${lambdaCodePath}/index.js`);
        }

        this.lambdaFunction = new LambdaFunction(this, 'LambdaFunction', {
            runtime: Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: Code.fromAsset(lambdaCodePath),
            functionName: props.functionName || `${this.stackName}-LambdaFunction`,
            memorySize: props.memorySize || 128,
            timeout: props.timeout || Duration.seconds(30),
            environment: {
                BUCKET_NAME: props.targetBucket.bucketName, // Using bucket name instead of ARN
                BUCKET_REGION: this.region,
                NODE_OPTIONS: '--enable-source-maps'
            },
        });

        // Add basic Lambda execution policy
        this.lambdaFunction.role?.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );

        // Grant specific permissions to the bucket
        props.targetBucket.grantReadWrite(this.lambdaFunction);

        // Add CloudWatch Logs permissions
        this.lambdaFunction.addToRolePolicy(new PolicyStatement({
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: ['*']
        }));

        // Output the Lambda ARN
        new CfnOutput(this, 'LambdaFunctionArn', {
            value: this.lambdaFunction.functionArn,
            description: 'ARN of the Lambda function',
            exportName: `${this.stackName}-LambdaArn`
        });
    }
}

export { AwsLambdaFunctionStack };