resource "aws_db_subnet_group" "rds_subnets" {
  name        = "${var.project_prefix}-db-subnet-group"
  description = "RDS Subnet Group across AZs"
  subnet_ids  = [aws_subnet.private_db_a.id, aws_subnet.private_db_b.id]

  tags = {
    Name = "${var.project_prefix}-db-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier            = "${var.project_prefix}-rds"
  engine                = "postgres"
  engine_version        = "16"
  instance_class        = "db.t4g.micro" # or db.t3.micro (Free Tier eligible)
  allocated_storage     = 20
  max_allocated_storage = 20 # Disable autoscaling storage to protect free tier
  storage_type          = "gp3"

  db_name  = "genesis"
  username = "genesis_admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.rds_subnets.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]

  publicly_accessible     = false # CRITICAL: Strict private data isolation
  multi_az                = false # Keep single AZ for free tier
  skip_final_snapshot     = true  # Allows clean automated destroy
  backup_retention_period = 0     # Free tier optimization
  deletion_protection     = false

  tags = {
    Name = "${var.project_prefix}-postgres-rds"
  }
}
