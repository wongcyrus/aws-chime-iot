#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsIotChimeStack } from '../lib/awsiotchime-stack';

const env = { region: 'ap-east-1' };
const app = new cdk.App();
new AwsIotChimeStack(app, 'AwsIotChimeStack', { env: env });
