data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_key_pair" "server" {
  key_name   = "forgeops-server"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "server" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.server.id]
  iam_instance_profile   = aws_iam_instance_profile.server.name
  key_name               = aws_key_pair.server.key_name
  user_data = templatefile("${path.module}/server/user-data.sh.tftpl", {
    region           = var.region
    release          = var.release
    domain           = local.domain
    github_app_id    = var.github_app_id
    github_app_slug  = var.github_app_slug
    github_client_id = var.github_client_id
    compose          = filebase64("${path.module}/server/compose.yml")
    caddy            = base64encode(templatefile("${path.module}/server/caddy.json.tftpl", { domain = local.domain }))
  })
  user_data_replace_on_change = true

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  lifecycle {
    ignore_changes = [ami]
  }

  tags = { Name = "forgeops-server" }
}

resource "aws_eip" "server" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = { Name = "forgeops-server" }
}

resource "aws_eip_association" "server" {
  instance_id   = aws_instance.server.id
  allocation_id = aws_eip.server.id
}

locals {
  domain = "${replace(aws_eip.server.public_ip, ".", "-")}.sslip.io"
}
