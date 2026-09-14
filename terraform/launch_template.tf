# Launch template: replaces the standalone aws_instance.app in compute.tf.
# Reuses the same data.aws_ami.ubuntu and aws_key_pair.deployer already
# defined in compute.tf — do not redeclare them here.

resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_prefix}-app-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
  key_name      = aws_key_pair.deployer.key_name

  vpc_security_group_ids = [aws_security_group.app_sg.id]

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size = 20
      volume_type = "gp3"
    }
  }

  # Safe instance metadata settings: require IMDSv2.
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    http_endpoint                = "enabled"
  }

  # IMPORTANT: your app is currently deployed by a separate CI/CD step that
  # SSHes into the fixed instance and (presumably) runs `docker compose up`.
  # That won't reach new instances the ASG creates on its own. Fill in the
  # TODO below so new instances self-configure on boot — then an ASG
  # instance refresh becomes your real "redeploy" mechanism.
  user_data = base64encode(<<-EOF
              #!/bin/bash
              apt-get update && apt-get install -y docker.io docker-compose-plugin postgresql-client-common postgresql-client
              systemctl enable --now docker
              usermod -aG docker ubuntu

              # TODO: replace with your real deploy steps, e.g.:
              # echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin
              # git clone https://github.com/dagr33/the-last-knight.git /opt/app
              # cd /opt/app && docker compose up -d
              EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_prefix}-app-host"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}
