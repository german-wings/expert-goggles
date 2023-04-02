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

import axios, { AxiosError } from "axios"
import { JSDOM } from "jsdom"
import _ from "lodash"
import XMLSerializer from "xmlserializer"
import xml2js from "xml2js"

class HaasBroker {
    constructor(ip_address, port_number, protocol) {
        this.ip_address = ip_address
        this.port_number = port_number
        this.protocol = protocol

        //helper switches
        this.nextRequest = "probe"
        this.offloadedElements = 0
        this.globalEventBuffer = []
        this.brokerInstanceId = null

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
        this.brokerInstanceId = null

        //set broker instanceID
        this.brokerInstanceId = new Date().getTime()

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
            if (error instanceof AxiosError) {
                console.log(`General Axios Error Reached ${error.message}`)
            }
            else {
                console.log(`Unknown Error ${error}`)
            }
            //reset to probe.
            this.nextRequest = 'probe'
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
            await this.fillBuffer(currentResponseDom)
            this.nextRequest = "sample"
        }

        catch (error) {
            if (error instanceof AxiosError) {
                console.log(`General Axios Error Reached ${error.message}`)
            }
            else {
                console.log(`Unknown Error ${error}`)
            }

            //reset to probe.
            this.nextRequest = 'probe'
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
            await this.fillBuffer(sampleResponseDom)
            this.nextRequest = "sample"
        }

        catch (error) {
            if (error instanceof AxiosError) {
                console.log(`General Axios Error Reached ${error.message}`)
            }
            else {
                console.log(`Unknown Error ${error}`)
            }

            //reset to probe.
            this.nextRequest = 'probe'
        }
    }

    //Handles the filling of responses
    /**
    @param {Document} responseData
    */
    async fillBuffer(responseData) {
        let eventList = responseData.querySelectorAll('[timestamp]')
        let listOfEvents = []

        //preparing to push the events in a local array
        //before we do so we are appending serial number and instance id as attributes
        eventList.forEach(element => {
            element.setAttribute("serialNumber", this.serialNumber)
            element.setAttribute("instanceId", this.instanceId)
            element.setAttribute("brokerInstanceId", this.brokerInstanceId)

            //experimental add correct time
            let elements_timestamp = new Date(element.getAttribute('timestamp')).getTime()
            let current_timestamp = new Date().getTime()

            if (elements_timestamp > current_timestamp) {
                //clocks running too fast on the machine
                let correctedTime = elements_timestamp - this.driftTime
                element.setAttribute("localTime", new Date(correctedTime).toLocaleString())
                
            }

            else {
                //clocks running too slow on the machine
                let correctedTime = elements_timestamp + this.driftTime
                element.setAttribute("localTime", new Date(correctedTime).toLocaleString())
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
        //we are converting the xml tag to json and
        //we are checking if the event is already present
        //we are pushing the element as strings for easier comparision
        listOfEvents.forEach(async element => {
            const parser = new xml2js.Parser({explicitRoot :true})
            let elementJSON = await parser.parseStringPromise(XMLSerializer.serializeToString(element))
            //forming the object again
            let rootKey = Object.keys(elementJSON)[0]
            elementJSON = {
                root : rootKey,
                ...elementJSON[rootKey]['$'],
                data:elementJSON[rootKey]['_']
            }

            elementJSON = JSON.stringify(elementJSON)
            if (_.includes(this.globalEventBuffer, elementJSON) != true) {
                this.globalEventBuffer.push(elementJSON)
            }
        })

    }

    async sendToQueue(){
        //we are ready to push the message to the Queue / Database 
        //get events from globalEventBuffer
        let deltaEvents = this.globalEventBuffer.slice(this.offloadedElements)
        deltaEvents.forEach(event=>{
            console.log(event)
        })
        this.offloadedElements+=deltaEvents.length
    }


    async run() {
        const timer = seconds => new Promise(res => setTimeout(res, seconds * 1000))
        while (true) {
            await this.initiateProbe()
            await this.initiateCurrent()
            await this.initiateSample()
            await this.sendToQueue()
            await timer(5)
        }
    }
}

let haasObject = new HaasBroker("mtconnect.mazakcorp.com", "5611", "http")
//let haasObject = new HaasBroker("192.168.1.155", "8082", "http")
haasObject.run()