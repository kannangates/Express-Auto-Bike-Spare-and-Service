#!/bin/bash

# Express Auto Bike Management System - Database Setup Script
# This script sets up the PostgreSQL database with the complete schema

set -e  # Exit on any error

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-express_auto_bike_dev}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Express Auto Bike Management System - Database Setup${NC}"
echo "=================================================="

# Check if PostgreSQL is running
echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT${NC}"
    echo "Please ensure PostgreSQL is running and accessible."
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL connection successful${NC}"

# Check if database exists
echo -e "${YELLOW}Checking if database exists...${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${GREEN}✓ Database '$DB_NAME' exists${NC}"
else
    echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo -e "${GREEN}✓ Database '$DB_NAME' created${NC}"
fi

# Apply schema
echo -e "${YELLOW}Applying database schema...${NC}"
if [ -f "schema.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql > /dev/null
    echo -e "${GREEN}✓ Schema applied successfully${NC}"
else
    echo -e "${RED}Error: schema.sql file not found${NC}"
    exit 1
fi

# Validate schema
echo -e "${YELLOW}Validating schema...${NC}"
if [ -f "validate_schema.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f validate_schema.sql
    echo -e "${GREEN}✓ Schema validation completed${NC}"
else
    echo -e "${YELLOW}Warning: validate_schema.sql file not found, skipping validation${NC}"
fi

# Run tests (optional)
if [ "$1" = "--test" ]; then
    echo -e "${YELLOW}Running schema tests...${NC}"
    if [ -f "test_schema.sql" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f test_schema.sql
        echo -e "${GREEN}✓ Schema tests completed${NC}"
    else
        echo -e "${YELLOW}Warning: test_schema.sql file not found, skipping tests${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Database setup completed successfully!${NC}"
echo ""
echo "Database Details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""
echo "You can now connect to the database using:"
echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
echo ""
echo "To run schema tests:"
echo "  ./setup_database.sh --test"
echo ""
echo -e "${BLUE}Happy coding! 🚀${NC}"