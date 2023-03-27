/*
Sequence of Operations ?
Connect to the Client 
Initiate a probe request
Initiate a current / sample request 
Flatten the response add to the buffer
One Broker for each device
If a communication sequence fails in between at client side
Reset and start the process again keep the buffer
If a communication sequence fails in between at server side
Reset and start the process again

*/

import axios from "axios"
import { JSDOM } from "jsdom"
import _ from "lodash"
import XMLSerializer from "xmlserializer"
import fs from 'fs'

class HaasBroker {
    constructor(ip_address, port_number, protocol) {
        this.ip_address = ip_address
        this.port_number = port_number
        this.protocol = protocol

        //helper switches
        this.nextRequest = "probe"
        this.offloadedElements = 0
        this.globalEventBuffer = []
    }

    async initiateProbe() {

        //check the nextRequest?
        if (this.nextRequest != "probe") {
            //skip if next request is not probe
            return
        }

        //reset all switches
        this.nextSequence = null
        this.lastSequence = null
        this.serialNumber = null
        this.instanceId = null
        this.globalEventBuffer = []
        this.offloadedElements = 0

        let probe_url = `${this.protocol}://${this.ip_address}:${this.port_number}/${this.nextRequest}`

        //handling errors
        try {

            //there is a possibility of error in probeResponse handle in production
            let probeResponse = await axios.get(probe_url, { headers: { 'Accept': 'text/xml' } })

            //prepare to collect probed data
            let probeResponseDom = new JSDOM(probeResponse.data).window.document
            this.instanceId = probeResponseDom.querySelector('[instanceId]').getAttribute('instanceId')
            this.serialNumber = probeResponseDom.querySelector('[serialNumber]').getAttribute('serialNumber')

            //prepare to sync our clocks and calculate the Machines drif time
            let machinesResponseCreationTime = new Date(probeResponseDom.querySelector('[creationTime]').getAttribute('creationTime'))
            machinesResponseCreationTime = machinesResponseCreationTime.getTime()
            let serverReceiptTime = new Date(new Date().toISOString())
            serverReceiptTime = serverReceiptTime.getTime()
            this.driftTime = (machinesResponseCreationTime - serverReceiptTime)

            //we must have acquired the serial number by now
            //set the next request state to current
            this.nextRequest = 'current'

        }
        catch (error) {
            //will handle general network error on client side or on server side
            //will handle programming errors
            console.log(error)
            throw error
        }

    }

    async initiateCurrent() {
        //current reqeuest here
        if (this.nextRequest != "current") {
            //nextRequest in not current
            return
        }

        let current_url = `${this.protocol}://${this.ip_address}:${this.port_number}/${this.nextRequest}`
        try {
            //there is a possibility of error in probeResponse handle in production
            let currentResponse = await axios.get(current_url, { headers: { 'Accept': 'text/xml' } })

            //prepare to collect probed data
            let currentResponseDom = new JSDOM(currentResponse.data).window.document

            //collect instanceId
            //if instanceId does not matches something is wrong we must reset
            let localInstanceId = currentResponseDom.querySelector('[instanceId]').getAttribute('instanceId')

            if (this.instanceId !== localInstanceId) {
                // dont process reset the state
                this.nextRequest = "probe"
                return
            }

            //fill the sequences first
            this.firstSequence = parseInt(currentResponseDom.querySelector('[firstSequence]').getAttribute('firstSequence'))
            this.nextSequence = parseInt(currentResponseDom.querySelector('[nextSequence]').getAttribute('nextSequence'))
            this.lastSequence = parseInt(currentResponseDom.querySelector('[lastSequence]').getAttribute('lastSequence'))


            //fill the buffer with artifacts
            this.fillBuffer(currentResponseDom)
            this.nextRequest = "sample"
        }

        catch (error) {
            console.log(error)
            throw error
        }
    }

    async initiateSample() {
        //sample reqeuest here
        if (this.nextRequest != "sample") {
            //nextRequest in not sample
            return
        }

        let sample_url = `${this.protocol}://${this.ip_address}:${this.port_number}/${this.nextRequest}?from=${this.nextSequence}`
        try {
            //there is a possibility of error in sampleResponse handle in production
            let sampleResponse = await axios.get(sample_url, { headers: { 'Accept': 'text/xml' } })
            //prepare to collect probed data
            let sampleResponseDom = new JSDOM(sampleResponse.data).window.document

            //collect instanceId
            //if instanceId does not matches something is wrong we must reset
            let localInstanceId = sampleResponseDom.querySelector('[instanceId]').getAttribute('instanceId')

            if (this.instanceId !== localInstanceId) {
                // dont process reset the state
                this.nextRequest = "probe"
                return
            }

            //handling out of range error
            if (sampleResponseDom.querySelector('[errorCode="OUT_OF_RANGE"]')) {
                const errorContent = sampleResponseDom.querySelector('[errorCode="OUT_OF_RANGE"]').textContent
                //resetting nextSequence number now !
                let errorSequenceNumber = parseInt(errorContent.match(/\d+/g)[0])
                if ((this.nextSequence - 1) === errorSequenceNumber) {
                    //we are good our poll rate is high
                    //circle back again
                    return
                }
                else {
                    this.nextRequest = 'probe'
                    return
                }
            }

            //fill the sequences first
            this.firstSequence = parseInt(sampleResponseDom.querySelector('[firstSequence]').getAttribute('firstSequence'))
            this.nextSequence = parseInt(sampleResponseDom.querySelector('[nextSequence]').getAttribute('nextSequence'))
            this.lastSequence = parseInt(sampleResponseDom.querySelector('[lastSequence]').getAttribute('lastSequence'))

            //fill the buffer with artifacts
            this.fillBuffer(sampleResponseDom)
            this.nextRequest = "sample"
        }

        catch (error) {
            console.log(error)
            throw error
        }
    }

    //Handles the filling of responses
    /**
    @param {Document} responseData
    */
    fillBuffer(responseData) {
        let eventList = responseData.querySelectorAll('[timestamp]')
        let listOfEvents = []

        //preparing to push the events in a local array
        //before we do so we are appending serial number and instance id as attributes
        eventList.forEach(element => {
            element.setAttribute("serialNumber", this.serialNumber)
            element.setAttribute("instanceId", this.instanceId)

            //experimental add correct time
            let elements_timestamp = new Date(element.getAttribute('timestamp')).getTime()
            let current_timestamp = new Date().getTime()

            if (elements_timestamp > current_timestamp) {
                //clocks running too fast on the machine
                let correctedTime = elements_timestamp - this.driftTime
                element.setAttribute("localTime",new Date(correctedTime).toLocaleString())
                element.setAttribute("correctedTime", elements_timestamp - this.driftTime)
            }

            else {
                //clocks running too slow on the machine
                let correctedTime = elements_timestamp + this.driftTime
                element.setAttribute("localTime",new Date(correctedTime).toLocaleString())
                element.setAttribute("correctedTime", elements_timestamp + this.driftTime)
            }
            listOfEvents.push(element)
        })

        //sorting in ascending order
        listOfEvents.sort((a, b) => {
            let a_timestamp = new Date(a.getAttribute('timestamp')).getTime()
            let b_timestamp = new Date(b.getAttribute('timestamp')).getTime()
            return a_timestamp - b_timestamp
        })

        //before pushing in to the global event log
        //we are checking if the event is already present
        //we are pushing the element as strings for easier comparision
        listOfEvents.forEach(element => {
            if (_.includes(this.globalEventBuffer, XMLSerializer.serializeToString(element)) != true) {
                this.globalEventBuffer.push(XMLSerializer.serializeToString(element))
            }
        })

    }


    async run() {
        const timer = seconds => new Promise(res => setTimeout(res, seconds * 1000))
        while (true) {
            await this.initiateProbe()
            await this.initiateCurrent()
            await this.initiateSample()

            //offload the data to Message Queue here
            let deltaEvents = this.globalEventBuffer.slice(this.offloadedElements)
            this.offloadedElements += deltaEvents.length

            //filter the data before sending to the message queue
            deltaEvents.forEach(element => {
                //write to a file
                console.log(element)
                fs.appendFile('log.txt', element + '\n', (error) => {
                    if (error) {
                        console.log('Error in writing')
                    }
                })
            })


            await timer(5)
        }
    }

}

//let haasObject = new HaasBroker("mtconnect.mazakcorp.com", "5611", "http")
let haasObject = new HaasBroker("192.168.1.152", "8082", "http")
haasObject.run()