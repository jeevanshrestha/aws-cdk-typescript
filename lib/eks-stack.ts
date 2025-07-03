import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Size } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { vars } from '../config/vars';

export interface EksStackProps extends cdk.StackProps {
  readonly envName: keyof typeof vars.environments;
  readonly envConfig: typeof vars.environments.dev;
  readonly vpc: ec2.IVpc;
  readonly clusterVersion?: eks.KubernetesVersion;
  readonly instanceType?: ec2.InstanceType;
  readonly kubeUserArn?: string; // Specific property for direct user mapping
}

export class EksStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;
  public readonly nodeGroup: eks.Nodegroup;
  public ebsCsiDriverServiceAccount: eks.ServiceAccount;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    // Default values
    const clusterVersion = props.clusterVersion ?? eks.KubernetesVersion.V1_28;
    const instanceType = props.instanceType ?? new ec2.InstanceType('t3.medium');
    const kubeUserArn = props.kubeUserArn ?? `arn:aws:iam::${this.account}:root`;

    // Create the EKS cluster
    this.cluster = new eks.Cluster(this, 'JeevesEksCluster', {
      version: clusterVersion,
      vpc: props.vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      defaultCapacity: 0,
      clusterName: `jeeves-eks-${props.envName}`,
      outputClusterName: true,
      securityGroup: this.createEksSecurityGroup(props.vpc, props.envName),
      kubectlLayer: new KubectlV32Layer(this, 'KubectlLayer'),
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUDIT,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
        eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
        eks.ClusterLoggingTypes.SCHEDULER,
      ] as eks.ClusterLoggingTypes[],
      endpointAccess: eks.EndpointAccess.PUBLIC,
    });

    // Directly map the IAM user to system:masters group
    this.cluster.awsAuth.addUserMapping(
      iam.User.fromUserArn(this, 'KubeUser', kubeUserArn), {
        groups: ['system:masters']
      }
    );

    // Create managed node group
    this.nodeGroup = this.cluster.addNodegroupCapacity('NodeGroup', {
      instanceTypes: [instanceType],
      minSize: 2,
      maxSize: 5,
      desiredSize: 2,
      nodegroupName: `jeeves-ng-${props.envName}`,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      labels: {
        environment: props.envName,
        role: 'general',
      },
      tags: {
        'Name': `jeeves-ng-${props.envName}`,
        'Environment': props.envName,
      },
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      capacityType: eks.CapacityType.ON_DEMAND,
      diskSize: 20,
    });

    // Add SSM access to nodes
    this.nodeGroup.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Setup EBS CSI driver
    this.setupEbsCsiDriver();

    // Output the user mapping information
    new cdk.CfnOutput(this, 'KubeUserMapping', {
      value: `User ${kubeUserArn} granted system:masters access`,
      description: 'Direct IAM user access configuration',
    });
  }

  private createEksSecurityGroup(vpc: ec2.IVpc, envName: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'EksClusterSecurityGroup', {
      vpc,
      securityGroupName: `jeeves-eks-sg-${envName}`,
      description: 'Security group for EKS cluster',
      allowAllOutbound: true,
    });

    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTcp(), 'Allow internal VPC communication');
    
    return sg;
  }

  private setupEbsCsiDriver(): void {
    // Create service account with IRSA
    this.ebsCsiDriverServiceAccount = this.cluster.addServiceAccount('ebs-csi-sa', {
      name: 'ebs-csi-controller-sa',
      namespace: 'kube-system',
    });

    // Attach the necessary policies
    this.ebsCsiDriverServiceAccount.addToPrincipalPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: [
          'ec2:AttachVolume',
          'ec2:CreateSnapshot',
          'ec2:CreateTags',
          'ec2:CreateVolume',
          'ec2:DeleteSnapshot',
          'ec2:DeleteTags',
          'ec2:DeleteVolume',
          'ec2:DescribeAvailabilityZones',
          'ec2:DescribeInstances',
          'ec2:DescribeSnapshots',
          'ec2:DescribeTags',
          'ec2:DescribeVolumes',
          'ec2:DescribeVolumesModifications',
          'ec2:DetachVolume',
          'ec2:ModifyVolume',
        ],
      })
    );

    // Install the EBS CSI driver using Helm
    this.cluster.addHelmChart('EbsCsiDriver', {
      chart: 'aws-ebs-csi-driver',
      repository: 'https://kubernetes-sigs.github.io/aws-ebs-csi-driver',
      namespace: 'kube-system',
      release: 'aws-ebs-csi-driver',
      version: '2.20.0',
      wait: true,
      timeout: cdk.Duration.minutes(10),
      values: {
        controller: {
          serviceAccount: {
            create: false,
            name: this.ebsCsiDriverServiceAccount.serviceAccountName,
          },
          region: this.region,
          replicaCount: 2,
        },
        storageClasses: [
          {
            name: 'ebs-sc',
            annotations: {
              'storageclass.kubernetes.io/is-default-class': 'true',
            },
            volumeBindingMode: 'WaitForFirstConsumer',
            parameters: {
              type: 'gp3',
              encrypted: 'true',
              throughput: '125',
              iops: '3000',
            },
            reclaimPolicy: 'Delete',
            allowVolumeExpansion: true,
          },
        ],
      },
    });
  }
}