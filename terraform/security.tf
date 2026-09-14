# ALB security group: the new public entry point.
# app_sg (in network.tf) needs to be edited separately — see chat
# instructions — to only trust this SG for port 80 instead of 0.0.0.0/0.

resource "aws_security_group" "alb_sg" {
  name        = "${var.project_prefix}-alb-sg"
  description = "Security group for the public application load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from the internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_prefix}-alb-sg"
  }
}
