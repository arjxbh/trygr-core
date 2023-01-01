#!/bin/bash

PID=$(ps -ef | grep -i redis | grep 6379 | awk -F' ' '{print $2}')
kill $PID
