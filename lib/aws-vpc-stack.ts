import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface VPCStackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments; 
  readonly envConfig: typeof vars.environments.dev; // Pass environment config directly
}

export class VPCStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly jumpboxSecurityGroup: ec2.SecurityGroup;
  public readonly webSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: VPCStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.envConfig.account,
        region: props.envConfig.region,
      },
      description: `${vars.projectName} VPC Stack (${props.envName})`,
    });

    this.vpc = this.createVpc(props.envName, props.envConfig.vpcConfig);
    
    // Initialize security groups
    this.albSecurityGroup = this.createAlbSecurityGroup(props.envName);
    this.jumpboxSecurityGroup = this.createJumpboxSecurityGroup(props.envName);
    this.webSecurityGroup = this.createWebSecurityGroup(props.envName);
    this.dbSecurityGroup = this.createDbSecurityGroup(props.envName);
    
 
  }

  private createVpc(envName: string, vpcConfig: typeof vars.environments.dev.vpcConfig): ec2.Vpc {
    return new ec2.Vpc(this, 'ProjectVPC', {
      vpcName: `${vars.projectName}-${envName}-vpc`.toLowerCase().replace(/\s+/g, '-'),
      ipAddresses: ec2.IpAddresses.cidr(vpcConfig.cidr),
      maxAzs: vpcConfig.maxAzs,
      natGateways: vpcConfig.natGateways,
      subnetConfiguration: this.mapSubnetConfig(vpcConfig.subnetConfiguration),
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });
  }

  private mapSubnetConfig(subnetConfig: typeof vars.environments.dev.vpcConfig.subnetConfiguration) {
    return subnetConfig.map(subnet => ({
      name: subnet.name,
      subnetType: this.getSubnetType(subnet.subnetType),
      cidrMask: subnet.cidrMask,
    }));
  }

  private getSubnetType(type: string): ec2.SubnetType {
    const mapping: Record<string, ec2.SubnetType> = {
      'PUBLIC': ec2.SubnetType.PUBLIC,
      'PRIVATE_WITH_EGRESS': ec2.SubnetType.PRIVATE_WITH_EGRESS,
      'PRIVATE_ISOLATED': ec2.SubnetType.PRIVATE_ISOLATED
    };
    return mapping[type] || ec2.SubnetType.PRIVATE_ISOLATED;
  }
 

  private createAlbSecurityGroup(envName: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${vars.projectName}-alb-sg-${envName}`.toLowerCase().replace(/\s+/g, '-'),
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS traffic');
    
    return sg;
  }

  private createJumpboxSecurityGroup(envName: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'JumpboxSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${vars.projectName}-jumpbox-sg-${envName}`.toLowerCase().replace(/\s+/g, '-'),
      description: 'Security group for jumpbox access',
      allowAllOutbound: true,
    });

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');
    return sg;
  }

  private createWebSecurityGroup(envName: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${vars.projectName}-web-sg-${envName}`.toLowerCase().replace(/\s+/g, '-'),
      description: 'Security group for web servers',
      allowAllOutbound: true,
    });

    sg.addIngressRule(
      ec2.Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(80),
      'Allow HTTP from ALB'
    );
    sg.addIngressRule(
      ec2.Peer.securityGroupId(this.jumpboxSecurityGroup.securityGroupId),
      ec2.Port.tcp(22),
      'Allow SSH from jumpbox'
    );
    
    return sg;
  }

  private createDbSecurityGroup(envName: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${vars.projectName}-db-sg-${envName}`.toLowerCase().replace(/\s+/g, '-'),
      description: 'Security group for database access',
      allowAllOutbound: true,
    });

    sg.addIngressRule(
      ec2.Peer.securityGroupId(this.webSecurityGroup.securityGroupId),
      ec2.Port.tcp(3306),
      'Allow MySQL from web servers'
    );
    sg.addIngressRule(
      ec2.Peer.securityGroupId(this.jumpboxSecurityGroup.securityGroupId),
      ec2.Port.tcp(22),
      'Allow SSH from jumpbox'
    );
    
    return sg;
  }

  
}