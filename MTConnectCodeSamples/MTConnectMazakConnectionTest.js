

import { JSDOM } from 'jsdom'
import axios from 'axios'

//sample api to connect mazak hosted mtconnect simulator
//exhibits a simple connection process involving a probe - current - sample.

const target = "192.168.1.184:8082"
//const target = "mtconnect.mazakcorp.com:5610"

let wrapper = async () => {
    const currentResponse = await axios.get(`http://${target}/current?path=//Controller`)
    const currentResponseDOM = new JSDOM(currentResponse.data, { contentType: 'text/xml' })
    const listOfSequences = currentResponseDOM.window.document.querySelectorAll("[sequence]")
    const header = currentResponseDOM.window.document.querySelector('Header')
    const instanceId = header.getAttribute("instanceId")
    const nextSequence = header.getAttribute("nextSequence")
    const firstSequence = parseInt(header.getAttribute("firstSequence"))
    let lastSequence = header.getAttribute("lastSequence")

    let currentSequence = firstSequence

    while (true) {

        const sampleResponse = await axios.get(`http://${target}/current?at=${currentSequence}&path=//Controller`)
        const sampleResponseDOM = new JSDOM(sampleResponse.data, { contentType: 'text/xml' })
        
        const header = sampleResponseDOM.window.document.querySelector('Header')
        const sampleInstanceId = header.getAttribute("instanceId")
        const sampleNextSequence = parseInt(header.getAttribute("nextSequence"))
        const sampleLastSequence = parseInt(header.getAttribute("lastSequence"))
        const runStatus = sampleResponseDOM.window.document.querySelector("[name='RunStatus']").textContent
        const mode = sampleResponseDOM.window.document.querySelector("[name='Mode']").textContent
        const program = sampleResponseDOM.window.document.querySelector("[name='Program']").textContent
        const feedRateOverride = sampleResponseDOM.window.document.querySelector("[name='FeedrateOverride']").textContent

        console.log(`LS ${sampleLastSequence} NS ${sampleNextSequence} CS ${currentSequence} RSTAT ${runStatus} MODE ${mode} PROGRAM ${program} FEED ${feedRateOverride}`)
        currentSequence++
        if(currentSequence >= sampleNextSequence){
            currentSequence = sampleLastSequence
        }

        if(sampleInstanceId !== instanceId){
            console.log("Instance ID Fault")
        }
    }

}



wrapper()
