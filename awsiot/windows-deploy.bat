CALL npm install -g aws-cdk --force
CALL npm install -g typescript
CALL npm i
CALL npm run build
CALL cdk deploy --require-approval never --outputs-file stackOutputs.json
CALL jq.exe -r .AwsIotChimeStack.keyBucket stackOutputs.json > tmpFile
CALL set /p keyBucket= < tmpFile
CALL del tmpFile
CALL @echo %keyBucket%
CALL mkdir ..\client\certs
CALL aws s3 cp s3://%keyBucket%/certs/ ../client/certs --recursive
CALL aws s3 cp s3://%keyBucket%/clientConfig.json ../client/
CALL aws s3 cp s3://%keyBucket%/controllerConfig.json ../controller/