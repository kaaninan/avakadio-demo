import {
	StyleSheet,
	Text,
	View
} from 'react-native'
import React from 'react'

import { BleManager } from 'react-native-ble-plx';
import { useEffect, useState } from 'react';
import { Buffer } from 'buffer';

import UUID from './UUID'

const manager = new BleManager();

const App = () => {

	const [bleState, setBleState] = useState(["Start"]);
	
	const [batteryLevel, setBatteryLevel] = useState(-1);
	const [batteryState, setBatteryState] = useState(-1);

	const [sensor1State, setSensor1State] = useState(''); // CO, NH3, NO2 olcen sensor durumu, aciklama monitor kisminda
	const [sensor2State, setSensor2State] = useState(''); // Keton olcen sensor durumu, aciklama monitor kisminda
	const [CO, setCO] = useState(-1); // Values (12 bit)
	const [NH3, setNH3] = useState(-1); // Values (12 bit)
	const [NO2, setNO2] = useState(-1); // Values (12 bit)
	const [KETON, setKETON] = useState(-1); // Values (12 bit)



	useEffect(() => {
		const subscription = manager.onStateChange((state) => {
			if (state === 'PoweredOn') {
				setBleState(data => [...data, "PoweredOn"]);
				scanAndConnect();
				subscription.remove();
			}
		}, true);
		return () => subscription.remove();
	}, []);

	const scanAndConnect = () => {
		setBleState(data => [...data, "Scanning"]);
		manager.startDeviceScan(null, null, (error, device) => {
			if (error) {
				setBleState(data => [...data, "Error Scan"]);
				console.error(error)
				return
			}

			if(device.name != null){
				if (device.name.includes('Avakadio')) {
					setBleState(data => [...data, "Found"]);
					manager.stopDeviceScan();
					connect(device);
				}
			}
		});
	}

	const connect = (device) => {
		device.connect()
			.then((device) => {
				setBleState(data => [...data, "Connected"]);
				return device.discoverAllServicesAndCharacteristics()
			})
			.then(async (device) => {
				setBleState(data => [...data, "Monitoring"]);
				
				// Device Information
				const model_number_promise = await device.readCharacteristicForService(UUID.DEVICE_SERVICE, UUID.DEVICE_CHARACTERISTIC_MODEL_NUMBER)
				const serial_number_promise = await device.readCharacteristicForService(UUID.DEVICE_SERVICE, UUID.DEVICE_CHARACTERISTIC_SERIAL_NUMBER)
				const firmware_revision_promise = await device.readCharacteristicForService(UUID.DEVICE_SERVICE, UUID.DEVICE_CHARACTERISTIC_FIRMWARE_REVISION)
				const hardware_revision_promise = await device.readCharacteristicForService(UUID.DEVICE_SERVICE, UUID.DEVICE_CHARACTERISTIC_HARDWARE_REVISION)
				const manufacturer_promise = await device.readCharacteristicForService(UUID.DEVICE_SERVICE, UUID.DEVICE_CHARACTERISTIC_MANUFACTURER)

				let model_number = Buffer.from(model_number_promise.value, 'base64').toString('ascii')
				let serial_number = Buffer.from(serial_number_promise.value, 'base64').toString('ascii')
				let firmware_revision = Buffer.from(firmware_revision_promise.value, 'base64').toString('ascii')
				let hardware_revision = Buffer.from(hardware_revision_promise.value, 'base64').toString('ascii')
				let manufacturer = Buffer.from(manufacturer_promise.value, 'base64').toString('ascii')

				setBleState(data => [...data, "Model Number: " + model_number]);
				setBleState(data => [...data, "Serial Number: " + serial_number]);
				setBleState(data => [...data, "Firmware Revision: " + firmware_revision]);
				setBleState(data => [...data, "Hardware Revision: " + hardware_revision]);
				setBleState(data => [...data, "Manufacturer: " + manufacturer]);

				// Battery Level and State
				const battery_level = device.monitorCharacteristicForService(UUID.BATTERY_SERVICE, UUID.BATTERY_CHARACTERISTIC_LEVEL, (error, characteristic) => {
					let bl = parseInt(Buffer.from(characteristic.value, 'base64').toString('ascii').charCodeAt(0).toString())
					// README: bl Int value, 0 to 100 (percent)
					setBatteryLevel(parseInt(bl));
				})
				const battery_state = device.monitorCharacteristicForService(UUID.BATTERY_SERVICE, UUID.BATTERY_CHARACTERISTIC_STATE, (error, characteristic) => {
					let bs = parseInt(Buffer.from(characteristic.value, 'base64').toString('ascii').charCodeAt(0).toString())
					// README: bs Int value, 0 to 3 (states below)
					if(bs == 0){
						setBatteryState("Low Battery");
					}else if(bs == 1){
						setBatteryState("Nominal");
					}else if(bs == 2){
						setBatteryState("Charging");
					}else if(bs == 3){
						setBatteryState("Charging Done");
					}
				})

				// Sensor Status
				const sensor_state = device.monitorCharacteristicForService(UUID.SENSOR_SERVICE, UUID.SENSOR_CHARACTERISTIC_STATE, (error, characteristic) => {
					let data = Buffer.from(characteristic.value, 'base64').toString('ascii')
					if(!data.includes("%")){
						console.error("Corrupt Data")
					}else{
						let sensor1State = parseInt(data.split('#')[0])
						let sensor2State = parseInt(data.split('#')[1].split('%')[0])

						switch (sensor1State) {
							case 0:
								setSensor1State("Off");
								break;
							case 1:
								setSensor1State("Calibrating");
								break;
							case 2:
								setSensor1State("Working");
								break;
							default:
								break;
						}

						switch (sensor2State) {
							case 0:
								setSensor2State("Off");
								break;
							case 1:
								setSensor2State("Calibrating");
								break;
							case 2:
								setSensor2State("Working");
								break;
							default:
								break;
						}
					}
				})


				// Sensor Data
				// README: Toplamda 4 adet sensör var. Her bir charactericten iki adet data geliyor, bunlar CO NH3 NO2 ve KETON
				const sensor_values_1 = device.monitorCharacteristicForService(UUID.SENSOR_SERVICE, UUID.SENSOR_CHARACTERISTIC_DATA_FIRST, (error, characteristic) => {
					let data = Buffer.from(characteristic.value, 'base64').toString('ascii')
					if(!data.includes("%")){
						console.error("Corrupt Data")
					}else{
						let co_val = parseInt(data.split('#')[0])
						let nh3_val = parseInt(data.split('#')[1].split('%')[0])
						setCO(co_val)
						setNH3(nh3_val)
						
					}
				})

				const sensor_values_2 = device.monitorCharacteristicForService(UUID.SENSOR_SERVICE, UUID.SENSOR_CHARACTERISTIC_DATA_SECOND, (error, characteristic) => {
					let data = Buffer.from(characteristic.value, 'base64').toString('ascii')
					if(!data.includes("%")){
						console.error("Corrupt Data")
					}else{
						let no2_val = parseInt(data.split('#')[0])
						let keton_val = parseInt(data.split('#')[1].split('%')[0])
						setNO2(no2_val)
						setKETON(keton_val)
						
					}
				})

			})
			.catch((error) => {
				// Handle errors
				setBleState(data => [...data, "Error Connect"]);
				console.error(error)
			});
	}

	const renderLog = () => {
		let view = []
		if(bleState.length > 0){
			bleState.forEach(d => {
				view.push(<Text key={Math.random()}>{d}</Text>)
			})
			return(
				<View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
					<Text>Avakadio</Text>
					{view}
				</View>
			)
		}
	}

	const renderBattery = () => {
		if(batteryLevel != -1){
			return(
				<View style={{marginTop: 100, alignItems: 'center', borderWidth: 1}}>
					<Text>Battery Level: {batteryLevel}</Text>
					<Text>Battery State: {batteryState}</Text>
				</View>
			)
		}
	}

	const renderSensor = () => {
		if(sensor1State != ''){
			return(
				<View style={{marginBottom: 50, alignItems: 'center', borderWidth: 1}}>
					<Text>Sensor 1 State: {sensor1State}</Text>
					<Text>Sensor 2 State: {sensor2State}</Text>
					<Text>CO VAL: {CO}</Text>
					<Text>NO2 VAL: {NO2}</Text>
					<Text>O3 VAL: {NH3}</Text>
					<Text>KETON VAL: {KETON}</Text>
				</View>
			)
		}
	}

	return (
		<View style={{flex: 1}}>
			{renderLog()}
			{renderBattery()}
			{renderSensor()}
		</View>
	)
}

export default App

const styles = StyleSheet.create({})