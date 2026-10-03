#!/bin/sh

set -eu

API_LOG="/tmp/outplay-php-api.log"
/opt/lampp/bin/php -S 127.0.0.1:8000 -t /opt/lampp/htdocs >"$API_LOG" 2>&1 &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

./node_modules/.bin/ng serve
