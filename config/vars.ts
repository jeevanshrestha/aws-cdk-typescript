export const vars = {
    "environments": {
      "dev": {
        "environmentName": "Development",
        "tags": {
          "Project": "MyProject",
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
            }
          ]
        }
      },
      "prod": {
        "environmentName": "Production",
        "tags": {
          "Project": "MyProject",
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
    },
    "dev":{
      "account": "480926032159",
      "region": "us-east-1"
    },
    "prod":{
      "account": "480926032159",
      "region": "ap-southeast-2"
    }
}
    