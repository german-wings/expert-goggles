import axios from "axios"
import { JSDOM } from "jsdom"
import lodash from "lodash"

const device_1 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5610/',
    'keyOfInterest':[{
        'storage_name' : 'PROGRAM',
        'mt_connect_name' : 'program',
        'mt_connect_value' : undefined,
        'mt_connect_timestamp' : undefined,
        'storage_timestamp' : undefined
    },{
        'storage_name' : 'MODE',
        'mt_connect_name' : 'mode',
        'mt_connect_value' : undefined,
        'mt_connect_timestamp' : undefined,
        'storage_timestamp' : undefined
    },{
        'storage_name' : 'YAbs',
        'mt_connect_name' : 'Yabs',
        'mt_connect_value' : undefined,
        'mt_connect_timestamp' : undefined,
        'storage_timestamp' : undefined
    },
    {
        'storage_name' : 'CREATIONTIME',
        'mt_connect_name' : 'creationTime',
        'mt_connect_value' : undefined,
        'mt_connect_timestamp' : undefined,
        'storage_timestamp' : undefined
    }]
}

const device_2 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5611/',
    'keyOfInterest': ['Program', 'ProgramComment', 'ControllerMode'],
}


const device_3 = {
    'common_name': 'Machine #6',
    'endpoint': 'http://192.168.1.184:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_4 = {
    'common_name': 'Machine #3',
    'endpoint': 'http://192.168.1.116:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_5 = {
    'common_name': 'Machine #2',
    'endpoint': 'http://192.168.1.202:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_6 = {
    'common_name': 'Machine #5',
    'endpoint': 'http://192.168.1.28:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}


const mtconnect_devices = [device_1]
//const mtconnect_devices = [device_3, device_4, device_5, device_6]
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

            let deviceResponse = await axios.get(`${mtConnectRequestURL}`, { headers: { 'Accept': 'text/xml' ,'keepAlive':true}})
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

            //boiler plate code
            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

            //check if the lastSequence processed is also the lastSequence now ?
            if(device.lastSequence === parseInt(lastSequence)){
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
            list_of_sequences.sort((a, b) => {
                let a_timestamp = new Date(a.getAttribute('timestamp')).getTime()
                let b_timestamp = new Date(b.getAttribute('timestamp')).getTime()
                return a_timestamp - b_timestamp
            })

            //store last devicestate for comparision
            let lastDeviceState = device.keyOfInterest

            //process sequence line by line duplicates are allowed
            list_of_sequences.forEach((item) => {
                device.keyOfInterest.forEach(keys => {
                    if (item.matches(`[name="${keys.mt_connect_name}"]`)) {
                        keys.mt_connect_value = item.textContent
                        keys.mt_connect_timestamp = item.getAttribute('timestamp')
                        keys.storage_timestamp = new Date().toUTCString()
                    }
                })
            })

            let newDeviceState = device.keyOfInterest

            if(lodash.isEqual(lastDeviceState , newDeviceState)){
                //console.log('Last State')
                //console.dir(lastDeviceState)
            }
            else{
                console.log('New State')
                console.dir(newDeviceState)
            }

            //set nextRequestState to sample
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
