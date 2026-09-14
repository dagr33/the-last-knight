resource "aws_autoscaling_group" "app" {
  name                = "${var.project_prefix}-asg"
  vpc_zone_identifier = [aws_subnet.public_app.id, aws_subnet.public_app_b.id]
  target_group_arns   = [aws_lb_target_group.app.arn]

  min_size         = 2
  desired_capacity = 2
  max_size         = 2

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 60

  # Controlled replacement: when the launch template changes, roll
  # instances out gradually instead of all at once.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_prefix}-app-host"
    propagate_at_launch = true
  }
}
