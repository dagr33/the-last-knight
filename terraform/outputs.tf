output "alb_dns_name" {
  description = "Public DNS name of the application load balancer"
  value       = aws_lb.app.dns_name
}

output "target_group_arn" {
  description = "ARN of the application target group"
  value       = aws_lb_target_group.app.arn
}

output "asg_name" {
  description = "Name of the application autoscaling group"
  value       = aws_autoscaling_group.app.name
}

output "rds_endpoint" {
  description = "Private endpoint of the managed RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "Private hostname of the managed RDS instance"
  value       = aws_db_instance.postgres.address
}
