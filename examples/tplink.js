const { Client } = require('tplink-smarthome-api');

new Client()
  .startDiscovery({ deviceTypes: ['plug', 'bulb'] })
  .on('device-new', (device) => {
    console.log(device.alias, device.model);
  });
