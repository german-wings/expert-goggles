

import { JSDOM } from 'jsdom'
import axios from 'axios'

//sample api to connect mazak hosted mtconnect simulator
//exhibits a simple connection process involving a probe - current - sample

let wrapper = async () => {
    const currentResponse = await axios.get(`http://mtconnect.mazakcorp.com:5609/current?path=//Controller`)
    const currentResponseDOM = new JSDOM(currentResponse.data, { contentType: 'text/xml' })
    const listOfSequences = currentResponseDOM.window.document.querySelectorAll("[sequence]")

    let nextSequence = currentResponseDOM.window.document.querySelector("[nextSequence]")

    while (true) {
        const sampleResponse = await axios.get(`http://mtconnect.mazakcorp.com:5609/sample`)
        const sampleResponseDOM = new JSDOM(sampleResponse.data, { contentType: 'text/xml' })
        const listOfSequences = sampleResponseDOM.window.document.querySelectorAll("[sequence]")
        console.log(`Received ${listOfSequences.length}`)
        nextSequence = sampleResponseDOM.window.document.querySelector("[nextSequence]")
    }

}


wrapper()