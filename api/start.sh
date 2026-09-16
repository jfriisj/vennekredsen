#!/bin/sh
set -e

python -c 'from app import app, db; ctx = app.app_context(); ctx.push(); db.create_all(); ctx.pop()'

exec gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 60 app:app
