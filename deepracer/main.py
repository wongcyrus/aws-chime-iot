import flask
from flask import request, jsonify
import json
from core.web_core import Client

app = flask.Flask(__name__)
app.config["DEBUG"] = True

client = Client(password="39282662", ip="172.0.0.1")

@app.route('/', methods=['GET'])
def api():   
    # data = json.load(request.data.decode('utf-8'))
    print(request.headers)
    print(request.json)
    # try:
    #     client.start_car()
    # except Exception as err:
    #     print(err)
    return "ok"

app.run()