import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface EC2StackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments; 
  readonly envConfig: typeof vars.environments.dev; // Pass environment config directly
  readonly vpc: ec2.IVpc;
  readonly webSecurityGroup: ec2.SecurityGroup;
  readonly dbSecurityGroup: ec2.SecurityGroup;
  readonly instanceType?: ec2.InstanceType;
  readonly webInstanceCount?: number;
  readonly keyPairName?: string;
}

export class EC2Stack extends cdk.Stack {
  public readonly webInstances: ec2.Instance[];
  public readonly dbInstance: ec2.Instance;
  private readonly keyPair: ec2.IKeyPair;

  constructor(scope: Construct, id: string, props: EC2StackProps) {
    super(scope, id, {
      ...props,
      description: `${vars.projectName} EC2 Stack (${props.envName})`,
    });
    const keyPair =  ec2.KeyPair.fromKeyPairName(this, 'KeyPair', props.keyPairName || vars.keyPairName);
    this.keyPair = keyPair;
    // Create instances
    this.webInstances = this.createWebInstances(props);
    this.dbInstance = this.createDatabaseInstance(props);

    // Apply tags
    this.applyTags();

    // Output useful information
    this.createOutputs(props.envName);
  }

  private createWebInstances(props: EC2StackProps): ec2.Instance[] {
    const instances: ec2.Instance[] = [];
    const instanceCount = props.webInstanceCount ?? vars.defaultWebInstanceCount;
    const instanceType = props.instanceType ?? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM);

    for (let i = 0; i < instanceCount; i++) {
      // Add IAM role with least privilege
      const role = new iam.Role(this, `WebInstanceRole${i}`, {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        description: `Role for ${vars.projectName} web instance ${i} in ${props.envName}`,
      });

      role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      );

      // Custom policy for web server permissions
      role.addToPolicy(new iam.PolicyStatement({
        actions: [
          'cloudwatch:PutMetricData',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      }));

      const instance = new ec2.Instance(this, `WebInstance${i}`, {
        vpc: props.vpc,
        instanceType,
        machineImage: ec2.MachineImage.latestAmazonLinux2023({
          cachedInContext: true,
        }),
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroup: props.webSecurityGroup,
        keyPair: this.keyPair,
        instanceName: `${vars.projectName}-web-${props.envName}-${i}`,
        blockDevices: [{
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, {
            encrypted: true,
            deleteOnTermination: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        }],
        requireImdsv2: true, // Enforce IMDSv2 for better security
        role: role,
      });

      // User data with secure bootstrap
      instance.addUserData(
        '#!/bin/bash',
        'set -ex',
        'yum update -y',
        'yum install -y nginx',
        'systemctl start nginx',
        'systemctl enable nginx',
        // Secure nginx configuration
        'sed -i "s/^#server_tokens off;/server_tokens off;/" /etc/nginx/nginx.conf',
        // Create custom index page
        `echo "<!DOCTYPE html><html><head><title>${vars.projectName}</title></head>` +
        `<body><h1>${vars.projectName} - ${props.envName}</h1>` +
        `<p>Instance: ${i}</p><p>Environment: ${props.envName}</p></body></html>"` +
        ' > /usr/share/nginx/html/index.html',
        'systemctl restart nginx'
      );

      instances.push(instance);
    }

    return instances;
  }

  private createDatabaseInstance(props: EC2StackProps): ec2.Instance {
    // Database instance IAM role
    const dbRole = new iam.Role(this, 'DBInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: `Role for ${vars.projectName} database instance in ${props.envName}`,
    });

    dbRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Minimal permissions for database instance
    dbRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudwatch:PutMetricData',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    const instance = new ec2.Instance(this, 'DBInstance', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cachedInContext: true,
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroup: props.dbSecurityGroup,
      keyPair: this.keyPair,
      instanceName: `${vars.projectName}-db-${props.envName}`,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(30, {
          encrypted: true,
          deleteOnTermination: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
        }),
      }],
      requireImdsv2: true, // Enforce IMDSv2 for better security
      role: dbRole,
    });

    // Secure database installation
    instance.addUserData(
      '#!/bin/bash',
      'set -ex',
      'yum update -y',
      'yum install -y mysql-server',
      // Secure MySQL installation
      'systemctl start mysqld',
      'systemctl enable mysqld',
      'mysql_secure_installation <<EOF',
      'y',
      '$(aws secretsmanager get-secret-value --secret-id mysql-root-password --query SecretString --output text)',
      'y',
      'y',
      'y',
      'y',
      'EOF'
    );

    return instance;
  }

  private applyTags(): void {
    // Tag web instances with additional metadata
    this.webInstances.forEach((instance, i) => {
      cdk.Tags.of(instance).add('Name', `${vars.projectName}-web-${this.node.tryGetContext('envName')}-${i}`);

      cdk.Tags.of(instance).add('ResourceType', 'EC2');
      cdk.Tags.of(instance).add('Role', 'WebServer');
      cdk.Tags.of(instance).add('InstanceNumber', i.toString());
    });

    // Tag database instance
    cdk.Tags.of(this.dbInstance).add('Name', `${vars.projectName}-db-${this.node.tryGetContext('envName')}`);
    
    cdk.Tags.of(this.dbInstance).add('ResourceType', 'EC2');
    cdk.Tags.of(this.dbInstance).add('Role', 'Database');

  }

  private createOutputs(envName: string): void {
    // Get the environment name from parameter instead of context/props
    const exportPrefix = `${vars.projectName}-${envName}`.replace(/\s+/g, '-').toLowerCase();

    // Output web instance information
    this.webInstances.forEach((instance, i) => {
        new cdk.CfnOutput(this, `WebInstance${i}Id`, {
            value: instance.instanceId,
            description: `ID of Web Instance ${i}`,
            exportName: `${exportPrefix}-web-instance-${i}-id`,
        });
    });

    // Output database instance information
    new cdk.CfnOutput(this, 'DBInstanceId', {
        value: this.dbInstance.instanceId,
        description: 'ID of Database Instance',
        exportName: `${exportPrefix}-db-instance-id`,
    });
  }
}