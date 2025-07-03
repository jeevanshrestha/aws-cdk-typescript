import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

interface AwsS3StackProps extends StackProps {
    isProduction?: boolean;
    bucketNamePrefix?: string;
    lifecycleExpirationDays?: number;
}

class AwsS3Stack extends Stack {
    public readonly targetBucket: IBucket;

    constructor(scope: Construct, id: string, props: AwsS3StackProps) {
        super(scope, id, props);

        const {
            isProduction = false,
            bucketNamePrefix = 'jeeves',
            lifecycleExpirationDays = 30
        } = props;

        // Validate environment configuration exists
        const envConfig = vars.environments[isProduction ? 'prod' : 'dev'];
        if (!envConfig) {
            throw new Error(`Environment configuration not found for ${isProduction ? 'production' : 'development'}`);
        }

        // Create the S3 bucket with secure defaults
        const bucket = new Bucket(this, 'JeevesBucket', {
            bucketName: this.generateBucketName(bucketNamePrefix, isProduction),
            versioned: isProduction, // Only version in production
            removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            encryption: BucketEncryption.S3_MANAGED, 
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // Block all public access by default
            autoDeleteObjects: !isProduction, // Only auto-delete in non-production
            lifecycleRules: [
                {
                    abortIncompleteMultipartUploadAfter: Duration.days(7),
                    expiration: Duration.days(lifecycleExpirationDays),
                    noncurrentVersionExpiration: isProduction ? Duration.days(90) : undefined,
                },
            ],
            serverAccessLogsPrefix: 'access-logs',
        });

        this.targetBucket = bucket;

        // Outputs
        new CfnOutput(this, 'BucketName', {
            value: bucket.bucketName,
            description: 'The name of the S3 bucket',
            exportName: `${this.stackName}-BucketName`,
        });

        new CfnOutput(this, 'BucketArn', {
            value: bucket.bucketArn,
            description: 'The ARN of the S3 bucket',
            exportName: `${this.stackName}-BucketArn`,
        });

        this.applyTags(bucket, envConfig.tags);
    }

    private generateBucketName(prefix: string, isProduction: boolean): string {
        // Generate a compliant bucket name (lowercase, no underscores)
        const env = isProduction ? 'prod' : 'dev';
        const uniqueId = this.node.addr.substring(0, 8);
        return `${prefix}-${env}-${uniqueId}`.toLowerCase();
    }

    private applyTags(bucket: Bucket, tags: Record<string, string>): void {
        // Add standard tags
        Tags.of(bucket).add('ResourceType', 'S3Bucket');
        Tags.of(bucket).add('ManagedBy', 'CDK');

        // Add custom tags from config
        Object.entries(tags).forEach(([key, value]) => {
            Tags.of(bucket).add(key, value);
        });
    }
}

export { AwsS3Stack, AwsS3StackProps };