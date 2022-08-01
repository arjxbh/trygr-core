const { RingApi } = require('ring-client-api');

const doit = async () => {
    const ringApi = new RingApi({
        refreshToken: 'eyJhbGciOiJIUzUxMiIsImprdSI6Ii9vYXV0aC9pbnRlcm5hbC9qd2tzIiwia2lkIjoiYzEyODEwMGIiLCJ0eXAiOiJKV1QifQ.eyJpYXQiOjE2NTkzMDA3NzgsImlzcyI6IlJpbmdPYXV0aFNlcnZpY2UtcHJvZDp1cy1lYXN0LTE6ZjEwMmRlOWIiLCJyZWZyZXNoX2NpZCI6InJpbmdfb2ZmaWNpYWxfYW5kcm9pZCIsInJlZnJlc2hfc2NvcGVzIjpbImNsaWVudCJdLCJyZWZyZXNoX3VzZXJfaWQiOjYxODYyMDAxLCJybmQiOiItTlpCUnlJYTNrMS1jUSIsInNlc3Npb25faWQiOiI0YjViNDFmZC0zMmE2LTRiYjQtOTJkNS00MGFhYjZhZWU4MjEiLCJ0eXBlIjoicmVmcmVzaC10b2tlbiJ9.Rn_KSjtUlK3RUOXYc-NPqm_52VaiTyk-zW2jgLRJMKY9oFWLGY8F_i4Xg4xBWPOPIMdLE5YhCyPkzW8RCoS5cw'
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
