import * as cdk from '@aws-cdk/core';
import {CfnOutput, CustomResource, Duration, RemovalPolicy} from '@aws-cdk/core';
import {Bucket} from "@aws-cdk/aws-s3";
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import {CfnAccessKey, Effect, Policy, PolicyDocument, PolicyStatement, User} from '@aws-cdk/aws-iam';
import * as path from 'path';
import {CfnPolicy, CfnPolicyPrincipalAttachment, CfnThing, CfnThingPrincipalAttachment} from "@aws-cdk/aws-iot";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "@aws-cdk/custom-resources";


export class AwsIotChimeStack extends cdk.Stack {
    private keyBucket: Bucket;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        this.keyBucket = new Bucket(this, 'KeyBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        const KeyGeneratorLambda = new lambda.Function(this, 'KeyGeneratorLambda', {
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_14_X,
            timeout: Duration.minutes(1),
            environment: {
                BUCKET: this.keyBucket.bucketName
            }
        });
        KeyGeneratorLambda.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,   // ... and so on defining the policy
                actions: ["iot:CreateKeysAndCertificate", "iot:DeleteCertificate", "iot:UpdateCertificate"],
                resources: ["*"]
            })
        )
        this.keyBucket.grantReadWrite(KeyGeneratorLambda);


        const keyGeneratorCustomResource = new CustomResource(this, 'KeyGeneratorCustomResource', {
            serviceToken: KeyGeneratorLambda.functionArn
        });
        keyGeneratorCustomResource.node.addDependency(this.keyBucket);
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
                            actions: ["iot:Connect", "iot:Publish", "iot:Receive", "iot:Subscribe"],
                            resources: ["*"]
                        })
                ]
            })
        })
        new CfnPolicyPrincipalAttachment(this, "ClientPolicyPrincipalAttachment", {
            policyName: clientPolicy.ref,
            principal: certificateArn
        })

        const controllerUser = new User(this, 'ControllerUser');
        const policy = new Policy(this, 'ControllerPolicy');
        policy.attachToUser(controllerUser);
        this.keyBucket.grantRead(controllerUser);
        policy.addStatements(new PolicyStatement(
            {
                effect: Effect.ALLOW,
                actions: [
                    "chime:CreateMeetingWithAttendees",
                    "chime:CreateMeeting",
                    "chime:DeleteMeeting",
                    "chime:GetMeeting",
                    "chime:ListMeetings",
                    "chime:CreateAttendee",
                    "chime:BatchCreateAttendee",
                    "chime:DeleteAttendee",
                    "chime:GetAttendee",
                    "chime:ListAttendees",
                    "chime:ListAttendeeTags",
                    "chime:ListMeetingTags",
                    "chime:ListTagsForResource",
                    "chime:TagAttendee",
                    "chime:TagMeeting",
                    "chime:TagResource",
                    "chime:UntagAttendee",
                    "chime:UntagMeeting",
                    "chime:UntagResource"
                ],
                resources: ["*"]
            })
        );
        policy.addStatements(new PolicyStatement(
            {
                effect: Effect.ALLOW,
                actions: [
                    "iot:GetThingShadow",
                    "iot:UpdateThingShadow"
                ],
                resources: ["arn:aws:iot:" + this.region + ":" + this.account + ":thing/" + thing.ref]
            })
        );
        const accessKey = new CfnAccessKey(this, "ControllerAccessKey", {userName: controllerUser.userName});

        const iotEndPoint = new AwsCustomResource(this, 'GetIotEndPoint', {
            onCreate: {
                service: 'Iot',
                action: 'describeEndpoint',
                physicalResourceId: PhysicalResourceId.fromResponse('endpointAddress')
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
        });
        const clientConfig = {
            "host": iotEndPoint.getResponseField('endpointAddress'),
            "thingName": thing.ref
        }

        this.createConfigFileS3("clientConfig", clientConfig);
        const controllerConfig = {
            "awsIotRegion": this.node.tryGetContext('awsIotRegion'),
            "amazonChimeMediaRegion": this.node.tryGetContext('amazonChimeMediaRegion'),
            "thingName": thing.ref,
            "accessKeyId": accessKey.ref,
            "secretAccessKey": accessKey.attrSecretAccessKey
        }
        this.createConfigFileS3("controllerConfig", controllerConfig);

        new CfnOutput(this, 'certificateArn', {value: certificateArn});
        new CfnOutput(this, 'certificateId', {value: certificateId});
        new CfnOutput(this, 'thingName', {value: thing.ref});
        new CfnOutput(this, 'keyBucket', {value: this.keyBucket.bucketName});
        new CfnOutput(this, 'AccessKeyId', {value: accessKey.ref});
        new CfnOutput(this, 'SecretAccessKey', {value: accessKey.attrSecretAccessKey});

    }

    private createConfigFileS3(controllerConfigName: string, controllerConfig: any) {
        new AwsCustomResource(this, 'WriteS3File' + controllerConfigName, {
            onCreate: {
                service: 'S3',
                action: 'putObject',
                parameters: {
                    Body: JSON.stringify(controllerConfig),
                    Bucket: this.keyBucket.bucketName,
                    Key: controllerConfigName + '.json',
                },
                physicalResourceId: PhysicalResourceId.of('WriteS3File' + controllerConfigName)
            },
            policy: {
                statements: [new iam.PolicyStatement({
                    actions: ['s3:PutObject'],
                    resources: [`${this.keyBucket.bucketArn}/${controllerConfigName}.json`],
                })]
            }
        });
    }
}