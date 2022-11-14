import axios from "axios"
import { JSDOM } from "jsdom"

const device_1 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5610/',
    'keyOfInterest': ['program', 'mode'],
}

const device_2 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5611/',
    'keyOfInterest': ['Program', 'ProgramComment', 'ControllerMode'],
}


const device_3 = {
    'common_name' : 'Machine #6',
    'endpoint': 'http://192.168.1.184:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_4 = {
    'common_name' : 'Machine #3',
    'endpoint': 'http://192.168.1.116:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_5 = {
    'common_name' : 'Machine #2',
    'endpoint': 'http://192.168.1.202:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}

const device_6 = {
    'common_name' : 'Machine #5',
    'endpoint': 'http://192.168.1.28:8082/',
    'keyOfInterest': ['Program', 'RunStatus', 'Mode'],
}


//const mtconnect_devices = [device_1, device_2]
const mtconnect_devices = [device_3,device_4, device_5 , device_6]
const localDeviceStateList = []


/*
//Sample Object for recording state across loop iterations.

probeDone?true or false
currentDone?true or false
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
        if (device.probeDone == undefined || device.probeDone == false) {
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
            //set the currentDone to false
            device.currentDone = false
            //mark the device state as true
            device.probeDone = true
        }

        //request stage changes to current mode now
        //check if the probeIsDone
        //check if instanceID matches
        //populate initial values
        if (device.probeDone === true && device.instanceID != null && device.currentDone !== true) {

            let currentRequestURL = `${device.endpoint}current`
            let currentResponse = await axios.get(`${currentRequestURL}`, { headers: { 'Accept': 'text/xml' } })
            let dom = new JSDOM(currentResponse.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')

            //checking is instanceID matches if it doesnot skip using continue ! set probeDone false
            if (instanceID !== device.instanceID) {
                device.probeDone = false
                console.log('Instance ID Mismatch')
                continue
            }
            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

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

            //set this data to datastore
            //process sequence line by line
            list_of_sequences.forEach((item) => {
                device.keyOfInterest.forEach(keys=>{
                    if(item.matches(`[name="${keys}"]`)){
                        console.log(`CURRENT ${keys} ${item.textContent}`)
                    }
                })
            })
            //last before closing set currentRequest done...
            device.currentDone = true
        }

        //stage change to sample request
        //record streams of samples and update nextSequence automatically
        //if instance ID changes set probeDone to false
        if (device.currentDone === true) {
            //check state of nextSequence and lastSequence
            //if lastSequence is one less then nextSequence keep nextSequence equals to lastSequence
            //wait for new sequences to arrive
            device.nextSequence = (device.lastSequence + 1) === device.nextSequence ? device.lastSequence : device.nextSequence
            //get the nextSequence number from the device object
            let sampleRequest = await axios.get(`${device.endpoint}sample?from=${device.nextSequence}`, { headers: { 'Accept': 'text/xml' } })
            //check for Error in sample request first
            if (/error/.test(sampleRequest.data)) {
                console.log(sampleRequest.data)
                console.log(JSON.stringify(device))
                //set currentdone to false now
                device.probeDone = false
                continue
            }

            let dom = new JSDOM(sampleRequest.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')

            //checking is instanceID matches if it doesnot skip using continue ! set probeDone false
            if (instanceID !== device.instanceID) {
                device.probeDone = false
                console.log('Instance ID Mismatch')
                continue
            }

            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

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

            //check for lastSequenceTimeStamp
            //store last sequence received
            if( list_of_sequences.length > 0 && device.lastSequenceTimeStamp === list_of_sequences[list_of_sequences.length-1].getAttribute('timestamp')){
                //this is the sample timestamp processed already please continue
                //console.log(list_of_sequences[list_of_sequences.len-1].getAttribute('timestamp'))
                continue
            }

            //set last sequence timestamp
            device.lastSequenceTimeStamp = list_of_sequences[list_of_sequences.length-1].getAttribute('timestamp')

            //process sequence line by line
            list_of_sequences.forEach((item) => {
                device.keyOfInterest.forEach(keys=>{
                    if(item.matches(`[name="${keys}"]`)){
                        console.log(`CHANGE IN ${keys} ${item.textContent} @ ${item.getAttribute('timestamp')} ${device.common_name}`)
                    }
                })
            })

        }
    }

}

try{
    while (true) {
        await initiateMTConnectSequence()
    }
}

catch(error){
    console.log(error)
}
