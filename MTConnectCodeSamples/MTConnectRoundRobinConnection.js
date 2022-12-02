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
    },
    {
        'identifier_name': 'DHMT CODES',
        'mt_connect_name': 'DHMT_Codes',
        set mt_connect_value(value) {
            const ACTIVE_M_CODE = value.split(',')[2]
            this.ACTIVE_M_CODE
        },
        get mt_connect_value() {
            return this.ACTIVE_M_CODE
        },
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
    },
    {
        'identifier_name': 'DHMT CODES',
        'mt_connect_name': 'DHMT_Codes',
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

const simulator_device = {
    'common_name': 'Machine #5 VF4',
    'processedSequences': [],
    'endpoint': 'http://127.0.01:5000/',
    'keyOfInterest': [{
        'identifier_name': 'PROGRAM',
        'mt_connect_name': 'Program',
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


function Device(commonName , url){
    Device.commonName = commonName
    Device.endpoint = url
    Device.nextSequence = undefined
    Device.lastSequence = undefined
    Device.processedSequences = []
    Device.nextRequestState = 'probe'

    function resetState(){
        this.nextSequence = undefined
        this.nextRequestState = 'probe'
        this.lastSequence = undefined
        this.processedSequences = []
    }

    function updateProcessedSequences(list_of_sequences){

    }

    function updateState(state){
        switch(state.getAttribute('name')){

            case 'DHMT_Codes':
                //get DHMT Code and check for M Code if its M00 , M30 , M01
                //if it is then we must check this.state.RUNSTATUS if its stopped okay if its active and DHMT has any
                //of the conditions please change this.state.RUNSTATUS to STOPPED
                const ACTIVEMCODE = state.textContent.split(',')[2]
                if(this.state.RUNSTATUS === "ACTIVE" && (ACTIVEMCODE === '30' || ACTIVEMCODE === '1' || ACTIVEMCODE ==='0')){
                    //the code M30 / M01 / M00 is active we must set this.state.RUNSTATUS to STOPPED
                    this.state.RUNSTATUS === "STOPPED"
                    this.state.RUNSTATUS_CHANGE_TIME = state.getAttribute('timestamp')
                }
                break
            case 'RunStatus':
                this.state.RUNSTATUS = state.textContent
                this.state.RUNSTATUS_CHANGE_TIME = state.getAttribute('timestamp')
                break
            case 'Program':
                this.state.PROGRAM = state.textContent
                break
            case 'mode':
                this.state.MODE = state.textContent
                break
        }
    }

    function getState(){
        return this.state
    }

}




//const mtconnect_devices = [device_1]
const mtconnect_devices = [new Device('BHAVAR\'s DMG MORI SEIKI DMC FD DUO BLOCK' , 'http://127.0.0.1:5000')]
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

            console.log('Resetting...')
            device.resetState()
            console.log('Probing..')
            //please conduct a probe request
            let probeResponse = await axios.get(`${device.endpoint}probe`, { headers: { 'Accept': 'text/xml' } })
            let dom = new JSDOM(probeResponse.data).window.document
            let instanceID = dom.querySelector('[instanceId]').getAttribute('instanceId')
            //let serialNumber = dom.querySelector('[serialNumber]').getAttribute('serialNumber')?'Default':'Default'
            if (instanceID == null && serialNumber == null) {
                throw "Probe Response inconsistent"
            }
            //device.serialNumber = serialNumber
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
            //exfill the correct nextSequence number check if we have already processed that one ?
            //if yes then we are asking for new sequences and we are good
            //if we have not processed then we have missed and we must reset
            if (dom.querySelector('Error')) {
                if (dom.querySelector('[errorCode="OUT_OF_RANGE"]')) {
                    const errorContent = dom.querySelector('[errorCode="OUT_OF_RANGE"]').textContent
                    //resetting nextSequence number now !
                    let errorSequenceNumber = parseInt(errorContent.match(/\d+/g)[0]) + 1
                    if (device.processedSequences.indexOf(errorSequenceNumber)) {
                        //this is a processed sequence we are good
                        //console.log(`OUT_OF_RANGE_ERROR with ${device.nextSequence} vs should be ${errorSequenceNumber}`)
                        continue
                    }
                    else {
                        console.log(`Reset now we last processed ${device.processedSequences[device.processedSequences.length - 1]} we must be at ${errorSequenceNumber}`)
                    }
                }
            }


            //boiler plate code
            //continue getting new values here
            let firstSequence = dom.querySelector('[firstSequence]').getAttribute('firstSequence')
            let nextSequence = dom.querySelector('[nextSequence]').getAttribute('nextSequence')
            let lastSequence = dom.querySelector('[lastSequence]').getAttribute('lastSequence')

            //populate state related keys
            device.firstSequence = parseInt(firstSequence)
            device.nextSequence = parseInt(nextSequence)
            device.lastSequence = parseInt(lastSequence)

            //sort all the sequences in ascending order based on timestamp
            let sequences = dom.querySelectorAll('[sequence]')
            let list_of_sequences = []
            sequences.forEach((item) => list_of_sequences.push(item))
            list_of_sequences.sort((a, b) => {
                let a_timestamp = new Date(a.getAttribute('timestamp')).getTime()
                let b_timestamp = new Date(b.getAttribute('timestamp')).getTime()
                return a_timestamp - b_timestamp
            })


            //start processing sequence numbers ordered by TimeStamp
            list_of_sequences.forEach((sequence)=>{
                device.updateState(sequence)
            })

            //add all the sequences to the processedBucket list now
            //sort all sequences in order based on sequence numbers
            list_of_sequences.sort((a, b) => {
                let sequence_a = parseInt(a.getAttribute('sequence'))
                let sequence_b = parseInt(b.getAttribute('sequence'))
                return sequence_a - sequence_b
            })
            list_of_sequences.forEach(item => device.processedSequences.push(parseInt(item.getAttribute('sequence'))))

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
