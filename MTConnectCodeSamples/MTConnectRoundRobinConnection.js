import axios from "axios"
import { JSDOM } from "jsdom"
import lodash from "lodash"
import winston from "winston";


//const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
  ],
});

//logger.add(console)

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
/* if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
} */

logger.remove(winston.transports.Console);






const device_2 = {
    'common_name': 'Machine #2 ST20Y',
    'processedSequences' : [],
    'endpoint': 'http://192.168.1.202:8082/',
    'keyOfInterest': [{
        'identifier_name': 'PROGRAM',
        'mt_connect_name': 'Program',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'MODE',
        'mt_connect_name': 'Mode',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'RUNSTATUS',
        'mt_connect_name': 'RunStatus',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }]
}

const device_6 = {
    'common_name': 'Machine #6 VF2',
    'processedSequences' : [],
    'endpoint': 'http://192.168.1.184:8082/',
    'keyOfInterest': [{
        'identifier_name': 'PROGRAM',
        'mt_connect_name': 'Program',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'MODE',
        'mt_connect_name': 'Mode',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'RUNSTATUS',
        'mt_connect_name': 'RunStatus',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }]
}


const device_5 = {
    'common_name': 'Machine #5 VF4',
    'processedSequences' : [],
    'endpoint': 'http://192.168.1.28:8082/',
    'keyOfInterest': [{
        'identifier_name': 'PROGRAM',
        'mt_connect_name': 'Program',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'MODE',
        'mt_connect_name': 'Mode',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'RUNSTATUS',
        'mt_connect_name': 'RunStatus',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }]
}


//const mtconnect_devices = [device_1]
const mtconnect_devices = [device_6]
const localDeviceStateList = []


/*
//Sample Object for recording state across loop iterations.

nextRequestState : probe / current / sample
instanceID
serialNumber
currentSequence
keys of interest {objects}
endpoint
nextSequence
firstSequence
lastSequence
*/

async function initiateMTConnectSequence() {

    for (let counter = 0; counter < mtconnect_devices.length; counter += 1) {

        //check if the device has a probeRequest conducted?
        let device = mtconnect_devices[counter]
        if (device.nextRequestState === undefined || device.nextRequestState === 'probe') {
            console.log('Probing..')
            //please conduct a probe request
            let probeResponse = await axios.get(`${device.endpoint}probe`, { headers: { 'Accept': 'text/xml' } })
            let dom = new JSDOM(probeResponse.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')
            let serialNumber = dom.querySelector('[serialNumber]').getAttribute('serialNumber')
            if (instanceID == null && serialNumber == null) {
                throw "Probe Response inconsistent"
            }
            device.serialNumber = serialNumber
            device.instanceID = instanceID

            //set nextRequestState to current
            device.nextRequestState = 'current'
        }

        //the state must be current or sample
        else if (device.nextRequestState === 'current' || device.nextRequestState === 'sample') {

            //set request url using nextRequestState
            let mtConnectRequestURL = device.nextRequestState === 'current' ? `${device.endpoint}current` : `${device.endpoint}sample`

            //if its a type of sample request
            //then please set the from parameter correctly
            if (device.nextRequestState === 'sample') {
                device.nextSequence = (device.lastSequence + 1) === device.nextSequence ? device.lastSequence : device.nextSequence
                mtConnectRequestURL += `?from=${device.nextSequence}`
            }

            let deviceResponse = await axios.get(`${mtConnectRequestURL}`, { headers: { 'Accept': 'text/xml', 'keepAlive': true } })
            let dom = new JSDOM(deviceResponse.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')

            //checking is instanceID matches if it doesnot skip using continue ! set probeDone false
            if (instanceID !== device.instanceID) {
                console.log('Instance ID Mismatch')
                device.nextRequestState = 'probe'
                continue
            }

            //check if a errorCode exists
            if (dom.querySelector('Error')) {
                console.log('Error Detected in response')
                device.nextRequestState = 'probe'
                continue
            }

            logger.info(deviceResponse.data)

            //boiler plate code
            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

            //check if the lastSequence processed is also the lastSequence now ?
            if (device.lastSequence == parseInt(lastSequence)) {
                //console.log('Skipping Sequences already processed')
                continue
            }

            //populate state related keys
            device.firstSequence = parseInt(firstSequence)
            device.nextSequence = parseInt(nextSequence)
            device.lastSequence = parseInt(lastSequence)

            //sort all the sequences in ascending order
            let sequences = dom.querySelectorAll('[sequence]')
            let list_of_sequences = []

            sequences.forEach((item) => list_of_sequences.push(item))

            //remove all processed sequence numbers !
            lodash.remove(list_of_sequences , (item)=>{
                if(device['processedSequences'].includes(parseInt(item.getAttribute('sequence')))){
                    //removing
                    //console.log('removing sequence number '+item.getAttribute('sequence'))
                    return true
                }
                else{
                    device['processedSequences'].push(parseInt(item.getAttribute('sequence')))
                    //console.log(`Length of Processed Sequences ${device['processedSequences'].length}`)
                    return false
                }
            })

            list_of_sequences.sort((a, b) => {
                let a_timestamp = new Date(a.getAttribute('timestamp')).getTime()
                let b_timestamp = new Date(b.getAttribute('timestamp')).getTime()
                return a_timestamp - b_timestamp
            })

            //capture oldState
            //create a shallow copy
            const oldState = JSON.parse(JSON.stringify(device.keyOfInterest))

            //process sequence line by line duplicates are allowed
            list_of_sequences.forEach((item) => {
                device.keyOfInterest.forEach(keys => {
                    if (item.matches(`[name="${keys.mt_connect_name}"]`)) {
                        keys.mt_connect_value = item.textContent
                        keys.mt_connect_timestamp = item.getAttribute('timestamp')
                        keys.storage_timestamp = new Date().toUTCString()
                        //set keys directly on object as a means to monitor state
                        device[keys.identifier_name] = keys.mt_connect_value + ' ' + item.getAttribute('sequence')+' ' + keys.mt_connect_timestamp
                    }
                })
            })

            const newState = JSON.parse(JSON.stringify(device.keyOfInterest))

            if (!lodash.isEqual(newState, oldState)) {
                //print all the keysofInterest
                let identifiers = device.keyOfInterest.map((item) => {
                    return item.identifier_name
                })
                console.log('-----------------------')
                console.log(device.common_name)
                identifiers.forEach((item) => console.log(`${item} : ${device[item]}`))
                console.log('**************************')
            }

            device.nextRequestState = 'sample'
        }
    }

}

try {
    while (true) {
        await initiateMTConnectSequence()
    }
}

catch (error) {
    console.log(error)
}
