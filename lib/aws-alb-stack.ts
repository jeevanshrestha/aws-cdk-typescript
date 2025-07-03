import * as cdk from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { InstanceTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface AlbStackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments; 
  readonly envConfig: typeof vars.environments.dev; // Pass environment config directly
  readonly vpc: ec2.IVpc;
  readonly albSecurityGroup: ec2.ISecurityGroup;
  readonly webInstances: ec2.Instance[];
}

export class AlbStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly webTargetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.envConfig.account,
        region: props.envConfig.region,
      },
      description: `${vars.projectName} ALB Stack (${props.envName})`,
    });

    // Create Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'JeevesALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      loadBalancerName: 'jeeves-alb',
    });

    // Create Target Group for web instances
    this.webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
      targetGroupName: 'web-tg',
    });

    // Correct way to register instances with the target group
    props.webInstances.forEach(instance => {
      this.webTargetGroup.addTarget(new InstanceTarget(instance, 80));
    });

    // Add HTTP listener
    this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([this.webTargetGroup])
    });

    // Add Tags to ALB
    cdk.Tags.of(this.alb).add('Name', 'jeeves-alb');
     

    // Target Group Tags
    cdk.Tags.of(this.webTargetGroup).add('Name', 'web-tg');
     
  }
 
}