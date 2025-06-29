#!/bin/bash

# Coach Alex Voice Service Startup Script

set -e

echo "Starting Coach Alex Voice Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check environment variables
if [ ! -f "../.env" ]; then
    echo "Error: .env file not found in parent directory!"
    exit 1
fi

echo "Environment configuration found"

# Start the voice service
echo "Starting Coach Alex Voice Service..."
python main.py