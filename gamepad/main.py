from controller import Client
import time

client = Client(password="password", ip="127.0.0.1:8080")
client.start_car()
client.move(-0.9,-0.6,0.8)
time.sleep(5)
client.stop_car()