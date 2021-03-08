import sys
import json
from core.logger import Logger

import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder
from bs4 import BeautifulSoup
import urllib3

logger = Logger(logger="Deepracer-Api").getlog()


class DeepracerVehicleApiError(Exception):
    pass


class Client:
    def __init__(self, password, ip="192.168.1.155", name="deep_racer"):
        # logger.info("Create client with ip = %s", ip)
        self.session = requests.Session()
        urllib3.disable_warnings()
        self.password = password
        self.name = name
        self.ip = ip
        self.headers = None

        # basic path form deepracer console
        self.URL = "https://" + self.ip + "/"

        self.manual = True
        self.start = False
        self.csrf_token = None

    # General purpose methods
    def get_is_usb_connected(self):
        return self._get("api/is_usb_connected")

    def get_battery_level(self):
        return self._get("api/get_battery_level")

    def get_raw_video_stream(self):
        self._get_csrf_token()
        # Get the video stream
        video_url = self.URL + "/route?topic=/display_mjpeg&width=480&height=360"

        return self.session.get(
            video_url, headers=self.headers, stream=True, verify=False
        )

    #  methods for running autonomous mode

    def set_autonomous_mode(self):
        # Set the car to use the autonomous mode and not care about input from this program
        self.stop_car()
        data = {"drive_mode": "auto"}
        return self._put("api/drive_mode", data)

    def set_throttle_percent(self, throttle_percent):
        # Set the percent throttle from 0-100% (note for manual mode this has no effect)
        data = {"throttle": throttle_percent}
        return self._put("api/max_nav_throttle", data)

    #  methods for running manual mode

    def set_manual_mode(self):
        # Set the car to take in input from manual channels (ie this program)
        self.stop_car()
        data = {"drive_mode": "manual"}
        return self._put("api/drive_mode", data)

    def start_car(self):
        data = {"start_stop": "start"}
        return self._put("api/start_stop", data)

    def stop_car(self):
        data = {"start_stop": "stop"}
        return self._put("api/start_stop", data)

    def move(self, steering_angle, throttle, max_speed):
        # Set angle and throttle commands from -1 to 1
        data = {"angle": steering_angle,
                "throttle": throttle, "max_speed": max_speed}
        return self._put("api/manual_drive", data)

    # models

    def get_models(self):
        return self._get("api/models")

    def get_uploaded_models(self):
        return self._get("api/uploaded_model_list")

    def load_model(self, model_name):
        model_url = "api/models/" + model_name + "/model"
        return self._put(model_url, null)

    def upload_model(self, model_zip_path, model_name):
        model_file = open(model_zip_path, "rb")
        headers = self.headers
        multipart_data = MultipartEncoder(
            fields={
                # a file upload field
                "file": (model_name, model_file, None)
            }
        )
        headers["content-type"] = multipart_data.content_type
        upload_models_url = self.URL + "/api/uploadModels"

        return self.session.put(
            upload_models_url, data=multipart_data, headers=headers, verify=False
        )

    # calibration

    def set_calibration_mode(self):
        return self._get("api/set_calibration_mode")

    def get_calibration_angle(self):
        return self._get("api/get_calibration/angle")

    def get_calibration_throttle(self):
        return self._get("api/get_calibration/throttle")

    def set_calibration_throttle(self, throttle):
        return self._put("api/set_calibration/throttle", throttle)

    def set_calibration_angle(self, angel):
        return self._put("api/set_calibration/angle", angel)

    # helper methods

    def _get(self, url, check_status_code=True):
        self._get_csrf_token()
        logger.debug("> Get %s", url)
        response = self.session.get(
            self.URL + url, headers=self.headers, verify=False)
        if check_status_code:
            if response.status_code != 200:
                raise DeepracerVehicleApiError(
                    "Get action failed with status code {}".format(
                        response.status_code)
                )
        return json.loads(response.text)

    def _put(self, url, data, check_success=True):
        self._get_csrf_token()
        logger.debug("> Put %s with %s", url, data)
        response = self.session.put(
            self.URL + url, json=data, headers=self.headers, verify=False
        )
        if check_success:
            if response.status_code != 200 or response.text.find('success":true') < 0:
                raise DeepracerVehicleApiError(
                    "Put action failed with body text {}".format(response.text)
                )
        return json.loads(response.text)

    def _get_csrf_token(self):
        if self.csrf_token:
            return

        # Get the CSRF Token and logon on to a DeepRacer control interface session
        try:
            response = self.session.get(
                self.URL, verify=False, timeout=10
            )  # Cannot verify with Deep Racer
        except requests.exceptions.ConnectTimeout:
            raise DeepracerVehicleApiError(
                "The vehicle with URL '{}' did not respond".format(self.URL)
            )
        # The hack to find the csrf token
        soup = BeautifulSoup(response.text, "lxml")
        self.csrf_token = soup.select_one('meta[name="csrf-token"]')["content"]
        # primary header to login
        self.headers = {
            "X-CSRFToken": self.csrf_token,
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
        }
        payload = {"password": self.password}
        login_url = self.URL + "/login"
        post = self.session.post(
            login_url, data=payload, headers=self.headers, verify=False
        )
        if post.status_code != 200:
            raise DeepracerVehicleApiError(
                "Log in failed. Error message {}".format(post.text)
            )

        # secondary header for other commands
        self.headers = {
            "X-CSRFToken": self.csrf_token,
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
            "referer": self.URL + "/home",
            "origin": self.URL,
            "accept-encoding": "gzip, deflate, br",
            "content-type": "application/json",
            "accept": "*/*",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "x-requested-with": "XMLHttpRequest",
        }