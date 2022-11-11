import axios from "axios"
import { JSDOM } from "jsdom"

const device_1 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5610/',
    'keyOfInterest': ['Program', 'ProgramComment', 'ControllerMode'],
}

const device_2 = {
    'endpoint': 'http://mtconnect.mazakcorp.com:5611/',
    'keyOfInterest': ['Program', 'ProgramComment', 'ControllerMode'],
}

const mtconnect_devices = [device_1, device_2]
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
        console.log('--------------------------------------------------')
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
            list_of_sequences.sort((a, b) => parseInt(a.getAttribute('sequence')) - parseInt(b.getAttribute('sequence')))

            //last before closing set currentRequest done...
            device.currentDone = true
        }

        //stage change to sample request
        //record streams of samples and update nextSequence automatically
        //if instance ID changes set probeDone to false
        
        if(device.currentDone === true){
            
        }
    }

}

while (true) {
    await initiateMTConnectSequence()
}
