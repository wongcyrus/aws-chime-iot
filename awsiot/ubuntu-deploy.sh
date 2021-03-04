
sudo apt-get --assume-yes install jq
npm install -g aws-cdk --force
npm install -g typescript
npm i
npm run build
cdk deploy --require-approval never --outputs-file stackOutputs.json
keyBucket=$(cat stackOutputs.json | jq -r '.AwsIotChimeStack.keyBucket')
echo $keyBucket

mkdir ../client/certs
aws s3 cp s3://$keyBucket/certs/ ../client/certs --recursive 
aws s3 cp s3://$keyBucket/clientConfig.json ../client/
aws s3 cp s3://$keyBucket/controllerConfig.json ../controller/