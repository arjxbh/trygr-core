const { Client } = require('tplink-smarthome-api');

process.on('uncaughtException', err => {
	if (err.message && err.message === 'Could not determine device from sysinfo') return; //ignore invalid device crash
	console.log('UNHANDLED EXCEPION');
	console.log(err);
	process.exit(1);
});

const client = new Client();
let discovered = []
console.log('starting discovery...');

const printDevice = device => {
	const { _sysInfo, host, port } = device;

	const { alias, mic_type, model, dev_name, relay_state, brightness } = _sysInfo;

	console.log(`found ${alias} / ${dev_name} (${mic_type} | ${model}) at ${host}:${port} is currently ${relay_state ? 'ON' : 'OFF'} [${brightness}]`);

	return { alias, host, port, _sysInfo };
}

// have desk backlight brightness be the opposite of the main lighting in the room
const invertDesk = device => {
	if (device.alias.includes('fireplace')) {
		console.log(`fireplace room online, brightness: ${device._sysInfo.brightness}`);
		const deskTarget = 100 - device._sysInfo.brightness;
		console.log(`setting desk to ${deskTarget}`);

		const desk = discovered.find(d => d.alias.includes('desk'));
		if (desk) {
			console.log(desk._sysInfo.light_state);
			// TODO: check if device is on before pushing update
			client.getDevice({ host: desk.host })
			.then(d => d.lighting.setLightState({ ...desk._sysInfo.light_state, brightness: deskTarget }));
		}
	}
}

const rememberDevice = ({ alias, host, port, _sysInfo }) => {
	discovered.push({ alias, host, port, _sysInfo });
}

client.startDiscovery()
.on('device-new', device => {
	console.log('DISCOVERED DEVICE:');
	rememberDevice(printDevice(device));
	
	// if (alias.includes('desk')) {
	// 	// console.log('setting fireplace room brightness');
	// 	// device.setPowerState(true);
	// 	// device.dimmer.setBrightness(100);
	// 	// console.log(device);
	// 	const lightState = device._sysInfo.light_state;
	// 	device.lighting.setLightState({ ...lightState, brightness: 100 });
	// }
})
.on('plug-online', device => {
	invertDesk(printDevice(device));
	// update device state in local cache
});
