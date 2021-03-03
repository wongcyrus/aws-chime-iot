import * as cdk from '@aws-cdk/core';
import {CfnOutput, CustomResource, Duration, RemovalPolicy} from '@aws-cdk/core';
import {Bucket} from "@aws-cdk/aws-s3";
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as cr from '@aws-cdk/custom-resources';
import * as iam from '@aws-cdk/aws-iam';
import {Effect, PolicyDocument, PolicyStatement} from '@aws-cdk/aws-iam';
import * as path from 'path';
import {CfnPolicy, CfnPolicyPrincipalAttachment, CfnThing, CfnThingPrincipalAttachment} from "@aws-cdk/aws-iot";

export class AwsIotChimeStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        const keyBucket = new Bucket(this, 'KeyBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        const KeyGeneratorLambda = new lambda.Function(this, 'KeyGeneratorLambda', {
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_14_X,
            timeout: Duration.minutes(1),
            environment: {
                BUCKET: keyBucket.bucketName
            }
        });
        KeyGeneratorLambda.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,   // ... and so on defining the policy
                actions: ["iot:CreateKeysAndCertificate", "iot:DeleteCertificate", "iot:UpdateCertificate"],
                resources: ["*"]
            })
        )
        keyBucket.grantReadWrite(KeyGeneratorLambda);


        const keyGeneratorCustomResource = new CustomResource(this, 'KeyGeneratorCustomResource', {serviceToken: KeyGeneratorLambda.functionArn});
        const certificateArn = keyGeneratorCustomResource.getAttString("CertificateArn");
        const certificateId = keyGeneratorCustomResource.getAttString("CertificateId");

        const thing = new CfnThing(this, "ClientThing");
        const clientThingPrincipalAttachment = new CfnThingPrincipalAttachment(this, "ClientThingPrincipalAttachment",
            {
                thingName: thing.ref,
                principal: certificateArn
            })

        const clientPolicy = new CfnPolicy(this, "ClientPolicy", {
            policyDocument: new PolicyDocument({
                statements: [
                    new PolicyStatement(
                        {
                            effect: Effect.ALLOW,
                            actions: ["iot:Connect"],
                            resources: ["arn:aws:iot:" + this.region + ":" + this.account + ":client/" + certificateId]
                        }),
                    new PolicyStatement(
                        {
                            effect: Effect.ALLOW,
                            actions: ["iot:UpdateThingShadow", "iot:GetThingShadow"],
                            resources: ["arn:aws:iot:" + this.region + ":" + this.account + ":thing/" + thing.ref]
                        })
                ]
            })
        })
        new CfnPolicyPrincipalAttachment(this, "ClientPolicyPrincipalAttachment", {
            policyName: clientPolicy.ref,
            principal: certificateArn
        })

        new CfnOutput(this, 'certificateArn', {value: certificateArn});
        new CfnOutput(this, 'certificateId', {value: certificateId});
        new CfnOutput(this, 'thingName', {value: thing.ref});
        new CfnOutput(this, 'keyBucket', {value: keyBucket.bucketName});
    }
}