import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface RdsDynamoDbStackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments;
  readonly envConfig: typeof vars.environments.dev;
  readonly vpc: ec2.IVpc;
  readonly dbSecurityGroup: ec2.SecurityGroup;
  readonly rdsInstanceType?: ec2.InstanceType;
  readonly databaseName?: string;
  readonly dynamoTableName?: string;
  readonly dynamoBillingMode?: dynamodb.BillingMode;

}

export class RdsDynamoDbStack extends cdk.Stack {
  public readonly rdsInstance: rds.DatabaseInstance;
  public readonly dynamoTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: RdsDynamoDbStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.envConfig.account,
        region: props.envConfig.region,
      },
      description: `${vars.projectName} RDS and DynamoDB Stack (${props.envName})`,
    });

    // RDS Configuration
    const rdsInstanceType = props.rdsInstanceType || 
      ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
    const databaseName = props.databaseName || `${vars.projectName.replace(/\s+/g, '_')}_db`;

    // Create RDS instance with enhanced security
    this.rdsInstance = new rds.DatabaseInstance(this, 'RDSInstance', {
      vpc: props.vpc,
      instanceType: rdsInstanceType,
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbSecurityGroup],
      databaseName: databaseName,
  
      backupRetention: props.envName === 'prod' ? cdk.Duration.days(7) : cdk.Duration.days(1),
      deletionProtection: props.envName === 'prod',
      removalPolicy: props.envName === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      monitoringInterval: cdk.Duration.minutes(1), 
    });

    // DynamoDB Configuration
    const tableName = props.dynamoTableName || `${vars.projectName.replace(/\s+/g, '_')}_table`;

    // Create DynamoDB table with best practices
    this.dynamoTable = new dynamodb.Table(this, 'DynamoTable', {
      tableName: tableName,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER }, // Recommended for most use cases
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED, 
      removalPolicy: props.envName === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiry', // Optional TTL configuration
    });

    // Fine-grained IAM permissions for an IAM role to access DynamoDB
    // Create an IAM role for application or Lambda to access both RDS and DynamoDB
    const appRole = new iam.Role(this, 'AppRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'), // or 'lambda.amazonaws.com' if used by Lambda
      description: 'Role for application to access RDS and DynamoDB'
    });

    this.dynamoTable.grant(
      appRole,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem'
    );

    // Output important values
    new cdk.CfnOutput(this, 'RDSInstanceEndpoint', {
      value: this.rdsInstance.dbInstanceEndpointAddress,
      description: 'RDS Instance Endpoint',
      exportName: `Jeeves-${props.envName}-RdsEndpoint`,
    });

    new cdk.CfnOutput(this, 'DynamoTableName', {
      value: this.dynamoTable.tableName,
      description: 'DynamoDB Table Name',
      exportName: `Jeeves-${props.envName}-DynamoTableName`,
    });

    new cdk.CfnOutput(this, 'RdsSecretArn', {
    value: this.rdsInstance.secret?.secretArn || 'No secret generated',
    description: 'ARN of the RDS secret in Secrets Manager',
    exportName: `Jeeves${props.envName}RdsSecretArn`.replace(/-/g, ''),
});
  }
}