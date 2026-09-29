# The Last Knight

This project ships a Vite frontend, an Express + PostgreSQL backend, and a Terraform AWS deployment for a public ALB + EC2 + RDS setup.

## Local development

1. Copy the environment example if needed.
   - `cp .env.example .env`
2. Start the full local stack.
   - `docker compose up --build`
3. Frontend is served on `http://localhost:8080`.
4. Backend health endpoint is available at `http://localhost:3000/api/health`.
5. PostgreSQL is still started locally by Compose on port `5432`.

### What the local stack expects

- Frontend build output: `docker-dist/`
- Frontend serving: Nginx on port 80 inside the container
- API proxy: `/api/` is proxied to `http://backend:3000`
- Backend listen address: `0.0.0.0:3000`
- Database migration step: `node migrate.mjs` runs before the backend process starts
- RDS is not used locally; Compose keeps the Postgres container running

## AWS deployment overview

The Terraform configuration creates:

- VPC with 2 public + 2 private subnets across 2 AZs
- Internet Gateway and route tables
- Public ALB
- EC2 Auto Scaling Group in public subnets
- PostgreSQL RDS in private subnets
- Security groups for ALB, app, and DB
- IAM role for EC2 access to Secrets Manager and ECR
- ECR repositories for frontend and backend images

Important: the EC2 instances do not start until the image exists in ECR. That is why the first deployment sequence is: create ECR, build images, push them, create/configure RDS, then let EC2 boot the app.

## First AWS deployment sequence

1. Fill in the Terraform variables.
   - `cp terraform/terraform.tfvars.example terraform/terraform.tfvars`
   - Edit `my_ip`, `db_password`, and optionally `key_name`
2. Initialize Terraform.
   - `cd terraform && terraform init`
3. Validate and plan.
   - `terraform plan`
4. Create ECR repositories (Terraform does this automatically).
5. Build and push the Docker images:
   - `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com`
   - `docker build -t last-knight-frontend:latest -f frontend/Dockerfile .`
   - `docker tag last-knight-frontend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-frontend:latest`
   - `docker push <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-frontend:latest`
   - `docker build -t last-knight-backend:latest -f backend/Dockerfile .`
   - `docker tag last-knight-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-backend:latest`
   - `docker push <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-backend:latest`
6. Create the AWS infrastructure.
   - `terraform apply`
7. Confirm the ALB DNS name and the RDS endpoint from Terraform outputs.
8. Check application health through the public ALB endpoint: `http://<alb-dns-name>/api/health`

## AWS runtime configuration

- Local Compose keeps the PostgreSQL container for dev mode.
- AWS uses `docker-compose.aws.yml`, which intentionally omits the database container.
- The backend reads `DATABASE_URL` from AWS Secrets Manager at boot time.
- The frontend container runs Nginx on port `80` and proxies `/api/` to the backend container on port `3000`.
- EC2 starts Docker, logs into ECR, pulls the images, and then starts the application stack.
- Migrations run inside the backend container via the Dockerfile command: `node migrate.mjs && node --experimental-strip-types server.mjs`. This is intentionally not executed on every EC2 instance concurrently; the app should be deployed only after the database is ready and a single one-time migration flow is done through the backend container startup or a separate controlled job.

## Secrets and state

- Do not commit real secrets into the repository.
- Pass runtime values via AWS Secrets Manager and IAM policies.
- Terraform state can hold sensitive values if you use a remote backend with encryption; local `terraform.tfstate` files are not suitable for production secrets.

## Useful commands

### Local

```bash
docker compose up --build
docker compose down -v
```

### Terraform

```bash
cd terraform
terraform init
terraform validate
terraform plan
terraform apply
```

### AWS image push example

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -f frontend/Dockerfile -t last-knight-frontend:latest .
docker tag last-knight-frontend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-frontend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-frontend:latest

docker build -f backend/Dockerfile -t last-knight-backend:latest .
docker tag last-knight-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/last-knight-backend:latest
```
