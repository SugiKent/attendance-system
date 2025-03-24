#!/bin/bash

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE attendancedb;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

# Create .env file
cp backend/.env.example backend/.env

# Build and run the application
make build