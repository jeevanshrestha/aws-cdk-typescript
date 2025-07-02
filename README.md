# AWS CDK TypeScript Project

This project uses the [AWS Cloud Development Kit (CDK)](https://docs.aws.amazon.com/cdk/latest/guide/home.html) with TypeScript to define and deploy cloud infrastructure as code.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14.x or later)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [AWS CLI](https://aws.amazon.com/cli/) configured with your credentials
- [AWS CDK Toolkit](https://docs.aws.amazon.com/cdk/latest/guide/cli.html)

Install AWS CDK globally if you haven't already:

```bash
npm install -g aws-cdk
```

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

## Project Structure

- `bin/` - Entry point for the CDK app
- `lib/` - Stack definitions and constructs
- `cdk.json` - CDK Toolkit configuration

## Useful Commands

- **Build the project**

    Compile TypeScript to JavaScript:

    ```bash
    npm run build
    ```

- **Watch for changes**

    Automatically recompile on file changes:

    ```bash
    npm run watch
    ```

- **Run tests**

    Execute unit tests using Jest:

    ```bash
    npm run test
    ```

- **Deploy the stack**

    Deploy your CDK stack to your AWS account/region:

    ```bash
    npx cdk deploy
    ```

- **Diff the stack**

    Compare the deployed stack with your local changes:

    ```bash
    npx cdk diff
    ```

- **Synthesize CloudFormation template**

    Generate the CloudFormation template from your CDK code:

    ```bash
    npx cdk synth
    ```

- **Clean up resources**

    Destroy the deployed stack and remove AWS resources:

    ```bash
    npx cdk destroy
    ```

- **Clean build artifacts**

    Remove compiled files and reset the project state:

    ```bash
    npm run clean
    ```

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Note:** Always review AWS costs before deploying or destroying resources.
