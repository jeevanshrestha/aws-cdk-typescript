import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eip from 'aws-cdk-lib/aws-ec2'; // For Elastic IP
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface JumpboxStackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments; 
  readonly envConfig: typeof vars.environments.dev; // Pass environment config directly
  readonly vpc: ec2.IVpc;
  readonly jumpboxSecurityGroup: ec2.ISecurityGroup;
}

export class JumpboxStack extends cdk.Stack {
  public readonly jumpboxInstance: ec2.Instance;
  public readonly jumpboxEip: eip.CfnEIP;
  private readonly keyPair: ec2.IKeyPair;
  constructor(scope: Construct, id: string, props: JumpboxStackProps) {
    super(scope, id, props);

      // Create Key Pair
      this.keyPair =   ec2.KeyPair.fromKeyPairName(this, 'KeyPair', vars.keyPairName  );
    // Create jumpbox instance
    this.jumpboxInstance = new ec2.Instance(this, 'JumpboxInstance', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: props.jumpboxSecurityGroup,
      keyPair: this.keyPair,
      instanceName: `${vars.projectName}-jumpbox-${props.envName}`,
    });

    // Enable SSM access
    this.jumpboxInstance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Create Elastic IP
    this.jumpboxEip = new eip.CfnEIP(this, 'JumpboxEIP', {
      domain: 'vpc',
      tags: [{
        key: 'Name',
        value: 'jumpbox-eip'
      }],
    });

    // Associate EIP with jumpbox instance
    new eip.CfnEIPAssociation(this, 'JumpboxEipAssociation', {
      instanceId: this.jumpboxInstance.instanceId,
      allocationId: this.jumpboxEip.attrAllocationId,
    });

  }
}