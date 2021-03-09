from controller import Client
import time

client = Client(password="39282662", ip="127.0.0.1:8080")
client.start_car()
client.move(-0.46923076923076923,-0.9769230769230769,0.5)
time.sleep(5)
client.stop_car()