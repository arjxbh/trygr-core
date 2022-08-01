const { RingApi } = require('ring-client-api');
const { RING_REFRESH_TOKEN } = require('./app/config/env');

const doit = async () => {
    const ringApi = new RingApi({
        refreshToken: RING_REFRESH_TOKEN
      });
      
      const locations = await ringApi.getLocations()
      
      // console.log(locations);

      const devices = await locations[0].getDevices();

      devices.forEach(d => {
        const { deviceType, faulted, name } = d.initialData;
        console.log('@@@@ DEVICE @@@@@@');
        console.log({ deviceType, faulted, name });

        if (deviceType.includes('hub')) {
          console.log(`subscribing to ${name}`);
          d.onData.subscribe(data => {console.log('GOT UPDATE FOR BASE STATION!'); console.log(data)});
        }

        if (name === 'Rear Sliding Door') {
          console.log(d);
          d.onData.subscribe(data => {console.log('GOT UPDATE FOR SLIDING DOOR!'); console.log(data)});
        }
      })
}

doit();
