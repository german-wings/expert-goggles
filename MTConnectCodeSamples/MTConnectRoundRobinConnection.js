import axios, { AxiosError } from "axios"
import { JSDOM } from "jsdom"
import lodash from "lodash"
import { MongoClient, MongoError, MongoServerSelectionError } from "mongodb"
import { HaasDevice } from "./Classes/HaasDevice.js"
import { timer } from "./Helpers/Time.js"


//const mtconnect_devices = [device_1]
//new Device('Machine #5', 'http://192.168.1.29:8082/')
//new Device('Machine #2', 'http://192.168.1.202:8082/')
//
const mtconnect_devices = [ new HaasDevice('Machine #2', 'http://192.168.1.202:8082/')]


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
        try {

            if (device.nextRequestState === undefined || device.nextRequestState === 'probe') {

                console.log('Resetting...')
                device.resetState()
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
                    console.log(`Instance ID Error : Received ${instanceID}, having ${device.state.instanceID}`)
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
                            device.nextRequestState = 'probe'
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
                list_of_sequences.forEach((sequence) => {

                    //save local state to compare per sequence basis !
                    const previousState = JSON.parse(JSON.stringify(device.getState()))

                    //start update per sequence basis
                    device.updateState(sequence)

                    //as the state is updated we must check now for any changes per sequence number basis
                    //if changes are detected by per sequence basis we can exactly start and stop the states
                    //compare previous state and new state
                    //just checking if all the keys are present
                    if (Object.values(device.getState()).indexOf(undefined) < 0) {
                        if (!lodash.isEqual(previousState, device.getState())) {
                            //we must write the state here now !
                            const event = JSON.parse(JSON.stringify(device.getState()))
                            //const message = await collection.insertOne(event)
                            //console.dir(message.acknowledged === true ? "Writen Successfully.." : "Problem....")
                            console.dir(device.getState())
                        }
                    }
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

        catch (error) {
            if (error instanceof AxiosError) {
                //check what type of error was received
                //we are looking for a device unreachable error
                //if we found one we must reset the device state and attempt to reconnect...
                console.log('Network Error')

            }

            else if (error instanceof MongoServerSelectionError) {
                //probably a Database is not reachable
                device.resetState()
                console.log(error)
            }

            console.log(error)

        }
    }

}

try {
    //prep up database connections!
    const mongoclient = new MongoClient("mongodb://127.0.0.1:27017")
    const collection = mongoclient.db("Master").collection("MTConnectFeed")

    while (true) {
        await initiateMTConnectSequence()
        await timer(1)
    }
}

catch (error) {
    if (error instanceof MongoError) {
        console.log(error)
    }
}
