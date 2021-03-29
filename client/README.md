# client 

Amazon Chime Client runs at the edge devices such as AWS DeepRacer.

You must first complete the deployment of awsiot project. It will update the clientConfig.json and some files in certs folder.
Run the deepracer project in parallel.

#Install node.js 14

sudo apt-get install curl

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -

sudo apt-get install nodejs

#Install dependencies

npm i

#For development, 

npm run start

#To create the installer,

npn run package