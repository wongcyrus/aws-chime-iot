ip="$(ifconfig | grep -A 1 'mlan0' | tail -1 | cut -d ':' -f 2 | cut -d ' ' -f 1)"
sudo docker run --rm -p 5000:5000 -e hostIp="$ip" -e password='mBjaEwrN' --name deepracerapi deepracerapi 
