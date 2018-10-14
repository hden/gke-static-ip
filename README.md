# gke-static-ip [![CircleCI](https://circleci.com/gh/hden/gke-static-ip/tree/master.svg?style=svg)](https://circleci.com/gh/hden/gke-static-ip/tree/master)
Assign static external IPs to GKE nodes.

# What's this?
Many conventional APIs require your application to be whitelisted by IP addresses. Currently GKE noes not support static (reserved) IPs for egress. Configuring NATs and reverse proxies can be troublesome, so this is a simple script that can be invoked periodically.

This script assumes that you have several reserved external IPs in the same region as your cluster. It will try to assign IPs that match IP_PREFIX to instances that matched INSTANCE_PREFIX.

## Configuration
Set the following environment variables:
- PROJECT_ID: (Required) The GCP project id.
- INSTANCE_NAME_PREFIX: (Required) The prefix for instance names.
- IP_PREFIX: (Required) The prefix for the IP addresses.

## Required Permissions
- compute.addresses.get
- compute.addresses.list
- compute.addresses.use
- compute.instances.addAccessConfig
- compute.instances.deleteAccessConfig
- compute.instances.get
- compute.instances.list
- compute.subnetworks.useExternalIp

## Prior arts
- [KubeIP](https://github.com/doitintl/kubeip)
