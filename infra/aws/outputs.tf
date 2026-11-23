output "public_ip" {
  value = aws_eip.server.public_ip
}

output "dashboard" {
  value = "https://forgeops.${local.domain}"
}

output "ssh" {
  value = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ec2-user@${aws_eip.server.public_ip}"
}
