# VPC Definition
resource "aws_vpc" "main" {
  cidr_block           = "10.18.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_prefix}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_prefix}-igw"
  }
}

# Public Subnet 
resource "aws_subnet" "public_app" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.18.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_prefix}-public-app-subnet"
  }
}

# Private Subnet 1 
resource "aws_subnet" "private_db_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.18.2.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_prefix}-private-db-subnet-a"
  }
}

# Private Subnet 2 
resource "aws_subnet" "private_db_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.18.3.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "${var.project_prefix}-private-db-subnet-b"
  }
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${var.project_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public_app" {
  subnet_id      = aws_subnet.public_app.id
  route_table_id = aws_route_table.public.id
}

# Security Group: Public App Host
resource "aws_security_group" "app_sg" {
  name        = "${var.project_prefix}-app-sg"
  description = "Security group for public application host"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from engineer laptop"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description     = "HTTP from the ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_prefix}-app-sg"
  }
}

# Security Group: Private RDS PostgreSQL Instance
resource "aws_security_group" "db_sg" {
  name        = "${var.project_prefix}-db-sg"
  description = "Security group for private RDS instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL access from App SG only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }

  egress {
    description = "Outbound traffic within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  tags = {
    Name = "${var.project_prefix}-db-sg"
  }
}
