#!/bin/bash

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE attendancedb;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

sudo sed -i 's/peer/md5/g' /etc/postgresql/15/main/pg_hba.conf

sudo service postgresql restart

# Create .env file
cp backend/.env.example backend/.env

# Build and run the application
make build