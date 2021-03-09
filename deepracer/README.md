# deepracer

Proxy control request from client to DeepRacer local admin control admin web app.

You must first complete the deployment of awsiot project. 
Run the client project in parallel.

For setup, it will build the docker image deepracerapi

./setup.sh

To start the application, it will run docker container deepracerapi.
Modify the password in start.sh

./start.sh

To stop the application,

./stop.sh