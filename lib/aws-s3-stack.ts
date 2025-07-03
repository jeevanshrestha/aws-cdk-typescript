import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Bucket, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

class AwsS3Stack extends Stack {
 
    public readonly targetBucket: IBucket; // Changed from targetBucketArn to IBucket
    constructor(scope: Construct, id: string, props: StackProps, is_prod: boolean = false) {
        super(scope, id, props);

        // Generate a unique bucket name without tokens
        const bucketName = `jeeves-${is_prod ? 'prod' : 'dev'}-${this.node.addr.substring(0, 8)}`.toLowerCase();

        const bucket = new Bucket(this, 'JeevesBucket', {
            // Let CDK auto-generate a unique name (recommended approach)
            // bucketName: bucketName, // Remove this line to let CDK auto-generate
            versioned: true,
            removalPolicy: RemovalPolicy.DESTROY,
            encryption: BucketEncryption.S3_MANAGED,
            autoDeleteObjects: true,
            lifecycleRules: [
                {
                    expiration: Duration.days(30),
                },
            ],
        });
        // Assign the bucket to the public property
        this.targetBucket = bucket;
 
        new CfnOutput(this, 'BucketName', {
            value: bucket.bucketName,
            description: 'The name of the bucket',
        });

        this.applyTags(bucket, is_prod);
    }

    private applyTags(bucket: Bucket, isProd: boolean): void {
        const { tags, environmentName } = isProd 
            ? vars.environments.prod 
            : vars.environments.dev;

        Tags.of(bucket).add('Environment', environmentName);
        Object.entries(tags).forEach(([key, value]) => {
            Tags.of(bucket).add(key, value as string);
        });
    }
}

export { AwsS3Stack };