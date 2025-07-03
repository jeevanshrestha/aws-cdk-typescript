export const vars = {
  "projectName": "AWS Full Stack Project",
  "projectDescription": "A full stack application deployed on AWS using CDK, including VPC, EC2, S3, and Lambda.",
  "projectVersion": "1.0.0",  
  "keyPairName": "Terraform-Key", // Key pair name for EC2 instances
  "defaultInstanceType": "t3.micro", // Default instance type for EC2
  "defaultWebInstanceCount": 2, // Default number of web instances
    "environments": {
      "dev": {     
        "account": "480926032159",
        "region": "ap-southeast-2", 
        "tags": {
          "Project": "AWS Full Stack Project",
          "Environment": "Development",
          "Owner": "Jeevan Shrestha",
          "SupportEmail": "jeevan.shrestha@example.com",
          "CostCenter": "DEV-123",
          "DataClassification": "Internal"
        },
        "vpcConfig": {
          "cidr": "10.0.0.0/16",
          "maxAzs": 2,
          "natGateways": 1,
          "subnetConfiguration": [
            {
              "name": "public",
              "subnetType": "PUBLIC",
              "cidrMask": 24
            },
            {
              "name": "private",
              "subnetType": "PRIVATE_WITH_EGRESS",
              "cidrMask": 24
            },
            {
              "name": "isolated",
              "subnetType": "PRIVATE_ISOLATED",
              "cidrMask": 24
            }
          ]
        }
      },
      "prod": {
        "account": "480926032159",
        "region": "ap-southeast-2", 
        "tags": {
          "Project": "AWS Full Stack Project - Production",
          "Environment": "Production",
          "Owner": "Jeevan Shrestha",
          "SupportEmail": "jeevan.shrestha@example.com",
          "CostCenter": "PROD-456",
          "DataClassification": "Confidential"
        },
        "vpcConfig": {
          "cidr": "10.1.0.0/16",
          "maxAzs": 3,
          "natGateways": 2,
          "subnetConfiguration": [
            {
              "name": "public",
              "subnetType": "PUBLIC",
              "cidrMask": 24
            },
            {
              "name": "private",
              "subnetType": "PRIVATE_WITH_EGRESS",
              "cidrMask": 24
            },
            {
              "name": "isolated",
              "subnetType": "PRIVATE_ISOLATED",
              "cidrMask": 24
            }
          ]
        }
      }
    }
}
    