const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const iot = new AWS.Iot();

const bucketName = process.env.BUCKET;

//Reference from https://github.com/stelligent/cloudformation-custom-resources/blob/master/lambda/nodejs/customresource.js
exports.handler = async (event, context, callback) => {
    // Install watchdog timer as the first thing
    setupWatchdogTimer(event, context, callback)
    console.log('REQUEST RECEIVED:\n' + JSON.stringify(event))
    if (event.RequestType === 'Create') {
        console.log('CREATE!')
        // Put your custom create logic here

        let params = {
            setAsActive: true
        };
        const key = await iot.createKeysAndCertificate(params).promise();
        console.log(key);
        await writeTextFileToS3("certs/certificateArn.txt", key.certificateArn);
        await writeTextFileToS3("certs/certificateId.txt", key.certificateId);
        await writeTextFileToS3("certs/device.pem.crt", key.certificatePem);
        await writeTextFileToS3("certs/public.pem.key", key.keyPair.PublicKey);
        await writeTextFileToS3("certs/private.pem.key", key.keyPair.PrivateKey);

        const responseData = {
            'Message': "Key generated",
            'CertificateId': key.certificateId,
            'CertificateArn': key.certificateArn
        };
        return await sendResponse(event, context, 'SUCCESS', responseData);
    } else if (event.RequestType === 'Update') {
        console.log('UPDATE!')
        // Put your custom update logic here
        await sendResponse(event, context, 'SUCCESS', {'Message': 'Resource update successful!'})
    } else if (event.RequestType === 'Delete') {
        console.log('DELETE!')
        // Put your custom delete logic here
        const certificateId = await readTextFile("certificateId.txt");

        let params = {
            certificateId: certificateId, /* required */
            newStatus: 'INACTIVE' /* required */
        };
        await iot.updateCertificate(params).promise();
        params = {
            certificateId: certificateId, /* required */
            forceDelete: true
        };
        await iot.deleteCertificate(params).promise();
        return await sendResponse(event, context, 'SUCCESS', {'Message': 'Resource deletion successful!'})
    } else {
        console.log('FAILED!')
        await sendResponse(event, context, 'FAILED')
    }
}

async function readTextFile(key) {
    const data = await s3.getObject({Bucket: bucketName, Key: key}).promise();
    return data.Body.toString();
}

async function writeTextFileToS3(key, content) {
    let params = {
        Body: content,
        Bucket: bucketName,
        Key: key
    };
    await s3.putObject(params).promise();
}

function setupWatchdogTimer(event, context, callback) {
    const timeoutHandler = () => {
        console.log('Timeout FAILURE!')
        // Emit event to 'sendResponse', then callback with an error from this
        // function
        new Promise(() => sendResponse(event, context, 'FAILED'))
            .then(() => callback(new Error('Function timed out')))
    }

    // Set timer so it triggers one second before this function would timeout
    setTimeout(timeoutHandler, context.getRemainingTimeInMillis() - 1000)
}

// Send response to the pre-signed S3 URL
async function sendResponse(event, context, responseStatus, responseData) {
    console.log('Sending response ' + responseStatus)
    let responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    })

    console.log('RESPONSE BODY:\n', responseBody)

    let https = require('https')
    let url = require('url')

    let parsedUrl = url.parse(event.ResponseURL)
    let options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
            'content-type': '',
            'content-length': responseBody.length
        }
    }

    console.log('SENDING RESPONSE...\n')

    return new Promise((resolve, reject) => {
        let request = https.request(options, function (response) {
            console.log('STATUS: ' + response.statusCode);
            console.log('HEADERS: ' + JSON.stringify(response.headers));
            // Tell AWS Lambda that the function execution is done
            resolve(responseBody);
        })

        request.on('error', function (error) {
            console.log('sendResponse Error:' + error);
            // Tell AWS Lambda that the function execution is done
            // context.done();
            reject(error);
        });
        // write data to request body
        request.write(responseBody);
        request.end();
    });
}