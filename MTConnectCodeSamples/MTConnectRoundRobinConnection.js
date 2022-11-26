import axios from "axios"
import { JSDOM } from "jsdom"
import lodash from "lodash"

const device_2 = {
    'common_name': 'Machine #2 ST20Y',
    'processedSequences': [],
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
    'processedSequences': [],
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
    'processedSequences': [],
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


const mazak_device = {
    'common_name': 'Machine #77 Mazak',
    'processedSequences': [],
    'endpoint': 'http://mtconnect.mazakcorp.com:5610/',
    'keyOfInterest': [{
        'identifier_name': 'PROGRAM_COMMENT',
        'mt_connect_name': 'program_cmt',
        'mt_connect_value': undefined,
        'mt_connect_timestamp': undefined,
        'storage_timestamp': undefined
    }, {
        'identifier_name': 'MODE',
        'mt_connect_name': 'mode',
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
//

Algorithm : 
Probe Request to collect serialNumber and instanceID
Current Request once only
followed by a check on instance ID
followed by a immediate request to sample on the nextSequence received
check instanceID
check if OUT OF RANGE error is receieved if so remake the request

on receiveing responses
check for sequence numbers continuity
put processed sequences under a array

check for keysOfInterest in sequences


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
                mtConnectRequestURL += `?from=${device.nextSequence}`
            }

            let deviceResponse = await axios.get(`${mtConnectRequestURL}`, { headers: { 'Accept': 'text/xml', 'keepAlive': true } })
            let dom = new JSDOM(deviceResponse.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')

            //checking if instanceID matches if it doesnot skip using continue ! set probeDone false
            if (instanceID !== device.instanceID) {
                console.log('Instance ID Mismatch')
                device.nextRequestState = 'probe'
                continue
            }

            //check if a errorCode exists
            //look for a OUT_OF_RANGE error
            //exfill the correct nextSequence number and make a request again
            if (dom.querySelector('Error')) {
                //console.log('Error Detected in response')
                //specifically look for OUT_OF_RANGE
                if (dom.querySelector('[errorCode="OUT_OF_RANGE"]')) {
                    const errorContent = dom.querySelector('[errorCode="OUT_OF_RANGE"]').textContent
                    //resetting nextSequence number now !
                    console.log('Resetting nextSequence number')
                    device.nextSequence = parseInt(errorContent.match(/\d+/g)[0])+1
                }
                continue
            }


            //boiler plate code
            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

            //check here for sequence continuity
            //sort all the sequences in ascending order based on timestamp
            let sequences = dom.querySelectorAll('[sequence]')
            let list_of_sequences = []
            sequences.forEach((item) => list_of_sequences.push(item))
            list_of_sequences.sort((a, b) => {
                let a_timestamp = new Date(a.getAttribute('timestamp')).getTime()
                let b_timestamp = new Date(b.getAttribute('timestamp')).getTime()
                return a_timestamp - b_timestamp
            })

            //sort all sequences in order based on sequence numbers
            list_of_sequences.sort((a,b)=>{
                let sequence_a = parseInt(a.getAttribute('sequence'))
                let sequence_b = parseInt(b.getAttribute('sequence'))
                return sequence_a - sequence_b
            })

            //if no sequence is received please skip iteration
            if(list_of_sequences.length <=0){
                console.log('Empty Sequences')
                console.log(`Device NS ${device.nextSequence} - Received Sequence ${nextSequence}`)
                continue
            }

            //check for sequence continuity
            //we will compare last our processed sequence with the first one received ! now
            const firstSequenceReceived = parseInt(list_of_sequences[0].getAttribute('sequence'))
            const lastProcessedSequence = device.processedSequences[device.processedSequences.length-1]
            if(firstSequenceReceived != lastProcessedSequence+1 && device.processedSequences.length!=0){
                console.log(`Sequence number is broken ! Last Processed ${lastProcessedSequence} received now ${firstSequenceReceived}`)
                continue
            }


            //populate state related keys
            device.firstSequence = parseInt(firstSequence)
            device.nextSequence = parseInt(nextSequence)
            device.lastSequence = parseInt(lastSequence)


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
                        device[keys.identifier_name] = keys.mt_connect_value + ' ' + item.getAttribute('sequence') + ' ' + keys.mt_connect_timestamp
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


            //add all the sequences to the processedBucket list now
            list_of_sequences.forEach(item=>device.processedSequences.push(parseInt(item.getAttribute('sequence'))))

            list_of_sequences.forEach(item=>console.log(`Processing ${item.getAttribute('sequence')}`))

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
