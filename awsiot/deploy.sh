region=ap-east-1

sudo yum install jq -y

mkdir -p client/certs

key=$(aws iot create-keys-and-certificate \
    --region $region \
    --set-as-active \
    --certificate-pem-outfile "client/certs/device.pem.crt" \
    --public-key-outfile "client/certs/public.pem.key" \
    --private-key-outfile "client/certs/private.pem.key")

certificateArn=$(echo $key | jq -r ".certificateArn" )
certificateId=$(echo $key | jq -r ".certificateId" )
echo $certificateArn > "client/certs/certificateArn.txt"
echo $certificateId > "client/certs/certificateId.txt"

aws cloudformation create-stack --stack-name awsiotclient \
--region $region \
--template-body file://cfn.yaml \
--parameters    ParameterKey=certificateArn,ParameterValue=$certificateArn