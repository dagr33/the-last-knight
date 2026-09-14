# HW21 scaling decision

## Scope and continuity

- Provider: AWS
- Region: eu-west-1
- Project prefix: genesis-hw18
- Existing shared project resources remain in the same VPC and database stack.
- This homework adds the public application front door only: ALB, ALB security group, target group, launch template, and ASG.
- The managed PostgreSQL database remains private and continues to belong to the current stack.

## Existing project baseline

This project is a continuation of the same AWS stack already created for HW18/HW19.

Existing Terraform addresses in use:

- `aws_vpc.main`
- `aws_subnet.public_app`
- `aws_subnet.private_db_a`
- `aws_subnet.private_db_b`
- `aws_security_group.app_sg`
- `aws_security_group.db_sg`
- `aws_instance.app`
- `aws_db_instance.postgres`

The application listens on port 80 behind the front-end NGINX layer. The real backend health endpoint is `/health` and it returns a successful HTTP 200 when the API/database dependency is available.

## Application bootstrap and deployment model

The application VM is bootstrapped using Ubuntu 24.04 and Docker tooling via the EC2 user data script in the current Terraform configuration. The deployment itself is intentionally separate from AMI or user-data bootstrapping and is handled by CI/CD SSH deployment, which matches the project rule for autoscaling-safe app delivery.

The ALB/ASG pattern is therefore the public front door, while app deployment continues via a controlled SSH-based release workflow rather than baking the app into the AMI or trying to rely on user data for every ASG replacement.

## HW20 state handling

HW20 is deferred for this project. No new backend bucket or new remote state stack is created for HW21. The project continues to use the current local Terraform state, and this is documented as a deferred state migration rather than a completed HW20 backend implementation.

## Additions in this homework

The following resources are added for HW21:

- `aws_security_group.alb_sg`
- `aws_lb.app`
- `aws_lb_target_group.app`
- `aws_lb_listener.app_http`
- `aws_launch_template.app`
- `aws_autoscaling_group.app`
- `aws_subnet.public_app_b`
- `aws_route_table_association.public_app_b`

These are all incremental application-tier additions. No second VPC, no second database, no second bucket, and no second app environment are created.

## Security and cost decisions

- SSH remains limited to the engineer public IP via `var.my_ip`.
- The application security group only accepts traffic from the ALB on port 80; direct internet exposure of the application instance is removed.
- The ALB itself is public and accepts HTTP on port 80, which is the required public entry point.
- The RDS instance remains private and keeps PostgreSQL port 5432 restricted to the app security group.
- The ASG uses the smallest practical instance class (`t3.micro`) and a minimal fixed size of 2/2/2.
- No NAT Gateway or additional public/private network constructs are added.

## Health-check and failure behavior

The ALB target group uses the real application health endpoint `/health` and validates a 200 response. Healthy targets receive traffic, while unhealthy instances are removed from rotation automatically by the target group before the ALB forwards traffic to them.

This matches the project requirement that the public front door health-checks the real app path instead of a placeholder root path.

## Cleanup ownership

The HW21 resources are considered temporary front-door additions. If the instructor requires cleanup after verification, only the ALB, target group, listener, launch template, and ASG should be destroyed. The existing VPC, subnets, security groups, and database stay in the shared project state.

## Verification checklist

Before submission, the project should confirm:

- `terraform validate` succeeds
- `terraform plan` shows the expected incremental change set
- ALB DNS resolves and the public frontend receives traffic
- target health is healthy for both instances
- `/health` returns HTTP 200
- ASG desired/min/max capacity remains at 2
- database remains private and unchanged
- no secrets or state files are committed
