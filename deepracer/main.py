import flask
from flask import request, jsonify
import json
from core.web_core import Client
from flask_web_log import Log
import logging

app = flask.Flask(__name__)
app.config["LOG_TYPE"] = "STDOUT"
app.config["DEBUG"] = True
app.logger.setLevel(logging.DEBUG)
Log(app)

client = Client(logger=app.logger, password="mBjaEwrN", ip="172.17.0.1")

@app.route('/', methods=['GET'])
def api():   
    # data = json.load(request.data.decode('utf-8'))
    app.logger.info(request.headers)
    app.logger.info(request.json)
    try: 
        app.logger.info("Call DeepRacer")       
        client.start_car()
        client.move(-0.46923076923076923,-0.9769230769230769,0.5)
        app.logger.info(client.get_battery_level())
        app.logger.info("Called")     
    except Exception as err:
        app.logger.error(err)       
    return "ok"

app.run(host='0.0.0.0')
