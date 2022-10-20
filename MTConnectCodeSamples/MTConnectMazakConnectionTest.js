

import { JSDOM } from 'jsdom'
import axios from 'axios'

//sample api to connect mazak hosted mtconnect simulator
//exhibits a simple connection process involving a probe - current - sample.

const target = "192.168.1.184:8082"
//const target = "mtconnect.mazakcorp.com:5610"

let wrapper = async () => {
    const currentResponse = await axios.get(`http://${target}/current`)
    const currentResponseDOM = new JSDOM(currentResponse.data, { contentType: 'text/xml' })

    let listOfSequences = currentResponseDOM.window.document.querySelectorAll("[sequence]")

    //fill all sequences in an array
    let sequenceList = []
    listOfSequences.forEach(item => sequenceList.push(item))
    sequenceList.sort((node1, node2) => parseInt(node1.getAttribute("sequence")) - parseInt(node2.getAttribute("sequence")))

    const header = currentResponseDOM.window.document.querySelector('Header')
    const instanceId = header.getAttribute("instanceId")
    const nextSequence = header.getAttribute("nextSequence")
    const firstSequence = parseInt(header.getAttribute("firstSequence"))
    let lastSequence = header.getAttribute("lastSequence")


    //state variables
    let machineState = "UNAVAILABLE"
    let machineMode = "UNAVAILABLE"
    let programName = "UNAVAILABLE"

    //update state variables
    sequenceList.forEach((sequence) => {
        if (sequence.hasAttribute('name')) {
            if (sequence.getAttribute("name") === "RunStatus") {
                if (sequence.textContent !== machineState) {
                    machineState = sequence.textContent
                }
            }
        }

        if (sequence.hasAttribute('name')) {
            if (sequence.getAttribute("name") === "Program") {
                programName = sequence.textContent
            }
        }


    })

    let currentSequence = parseInt(sequenceList[sequenceList.length - 1].getAttribute("sequence"))

    while (true) {

        try {
            const sampleResponse = await axios.get(`http://${target}/sample?from=${currentSequence}`)
            const sampleResponseDOM = new JSDOM(sampleResponse.data, { contentType: 'text/xml' })

            const header = sampleResponseDOM.window.document.querySelector('Header')
            const sampleInstanceId = header.getAttribute("instanceId")
            const sampleNextSequence = parseInt(header.getAttribute("nextSequence"))
            const sampleLastSequence = parseInt(header.getAttribute("lastSequence"))
            const sampleFirstSequence = parseInt(header.getAttribute("firstSequence"))

            let sampleListofSequences = sampleResponseDOM.window.document.querySelectorAll("[sequence]")

            //fill all sequences in an array
            let sampleSequenceList = []
            sampleListofSequences.forEach(item => sampleSequenceList.push(item))
            sampleSequenceList.sort((node1, node2) => parseInt(node1.getAttribute("sequence")) - parseInt(node2.getAttribute("sequence")))

            sampleSequenceList.forEach((sequence) => {
                if (sequence.hasAttribute('name')) {
                    if (sequence.getAttribute("name") === "RunStatus") {
                        if (sequence.textContent !== machineState) {
                            machineState = sequence.textContent
                        }
                    }
                }

                if (sequence.hasAttribute('name')) {
                    if (sequence.getAttribute("name") === "Program") {
                        programName = sequence.textContent
                    }
                }

            })

            process.stdout.write("\r")
            process.stdout.write(`Processing End of Sequences ${currentSequence} NS ${sampleNextSequence} Machine State ${machineState} Program Name ${programName}\r`)



            currentSequence = parseInt(sampleSequenceList[sampleSequenceList.length - 1].getAttribute("sequence"))

            if (currentSequence === (sampleNextSequence - 1)) {
                process.stdout.write("\r")
                process.stdout.write(`Reaching End of Sequences ${currentSequence} NS ${sampleNextSequence} Machine State ${machineState}\r`)
                currentSequence = sampleLastSequence
            }

            else if (currentSequence < sampleNextSequence) {
                currentSequence = currentSequence + 1
            }
        }

        catch (error) {
            console.log(error)
            console.log(sampleResponse.data)
        }

    }

}



wrapper()
