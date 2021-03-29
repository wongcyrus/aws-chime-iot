#!/usr/bin/env python3

import sys
import numpy as np
from RPLidar import RPLidar


PORT_NAME = '/dev/ttyUSB0'


def run():
    '''Main function'''
    lidar = RPLidar()
    lidar.init(PORT_NAME)
    lidar.stop()
    lidar.disconnect()

if __name__ == '__main__':
    run()
