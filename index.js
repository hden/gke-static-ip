require('dotenv').config()
const _ = require('underscore')
const { find } = require('obj-case')
const debug = require('debug')('gke-static-ip')
const Compute = require('@google-cloud/compute')
const compute = new Compute({ projectId: process.env.PROJECT_ID })

async function getStaticIPs (prefix = '') {
  const items = await compute.getAddresses({ filter: `name eq ${prefix}.*` }).then(_.flatten)
  const reservedIPs = new Set()
  const staticIPs = new Map(await Promise.all(items.map(async function (address) {
    const metadata = await address.getMetadata().then(_.flatten)
    const ip = find(metadata, '0.address')
    const status = find(metadata, '0.status')
    if (status === 'RESERVED') {
      reservedIPs.add(ip)
    }
    return [ip, status]
  })))
  return { staticIPs, reservedIPs }
}

async function getInstances (prefix = '') {
  const items = await compute.getVMs({ filter: `name eq ${prefix}.*` }).then(_.flatten)
  return new Map(await Promise.all(items.map(async function (instance) {
    const metadata = await instance.getMetadata().then(_.flatten)
    const accessConfig = find(metadata, '0.networkInterfaces.0.accessConfigs.0')
    return [instance, accessConfig]
  })))
}

function request (instance, obj = {}) {
  return new Promise((resolve, reject) => {
    instance.request(obj, (e, operation) => {
      if (e) {
        return reject(e)
      }
      operation.once('error', reject)
      operation.once('complete', resolve)
    })
  })
}

function deleteAccessConfig (instance, accessConfig = 'external-nat', networkInterface = 'nic0') {
  return request(instance, {
    method: 'POST',
    uri: '/deleteAccessConfig',
    qs: { networkInterface, accessConfig }
  })
}

function addAccessConfig (instance, json = {}, networkInterface = 'nic0') {
  return request(instance, {
    method: 'POST',
    uri: '/addAccessConfig',
    qs: { networkInterface },
    json
  })
}

async function main () {
  const instances = await getInstances(process.env.INSTANCE_PREFIX)
  const { staticIPs, reservedIPs } = await getStaticIPs(process.env.IP_PREFIX)
  debug('Found %d reserved IP.', reservedIPs.size)
  if ((instances.size > 0) && (reservedIPs.size > 0)) {
    const availableIPs = Array.from(reservedIPs.values())
    for (let [instance, accessConfig] of instances) {
      const currentIP = find(accessConfig, 'natIP')
      if (!staticIPs.has(currentIP) && (availableIPs.length > 0)) {
        // Try to replace the ephemeral IP.
        const reservedIP = availableIPs.pop()
        debug('Replcing %s\'s IP from %s to %s.', instance.name, currentIP, reservedIP)
        if (currentIP) {
          // The access config is immutable, so it must be deleted first.
          await deleteAccessConfig(instance, process.env.ACCESS_CONFIG_NAME)
          debug('Removed existing IP for %s', instance.name)
        }
        await addAccessConfig(instance, Object.assign({}, accessConfig, { natIP: reservedIP }))
        debug('Assigned reserved IP %s for instance %s.', reservedIP, instance.name)
      }
    }
  }
}

main().catch(console.error.bind(console))
