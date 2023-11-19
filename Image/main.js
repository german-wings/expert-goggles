/**
 * This application communicates with the Device (only one single device who has a matching serial number)
 * Once that device is located it records the UUID
 * Following a Current request is made , data related to that uuid is extracted
 * Following a Sample request is made
 * For each category a full current request type document is updated and shared over the Message Queue
 */


const axios = require('axios')
const JSDOM = require('jsdom')

//Some variables that will be in the enviroment via Docker Compose !
const ENDPOINT_MAC = ""
const BASE_URL = "https://smstestbed.nist.gov/vds/GFAgie01"
const ENDPOINT_SERIAL_NUMBER = ""
const POLL_INTERVAL = 50


//some global variables to use in the script
var globalNextRequestType = 'probe'
var globalClassifiedElements = {}
var globalNextSequence = null
var globalMachineState = null


function resetState() {
    globalNextRequestType = 'probe'
    globalNextSequence = null
    globalMachineState = null
}


async function getXMLResponse(request) {
    const response = await axios(request)
    if (response.status !== 200) {
        throw Error(`Invalid HTTP Response /n ${response}`)
    }

    const dom = new JSDOM.JSDOM(response.data, { contentType: 'application/xml' })

    if (dom === null || dom === undefined) {
        throw Error()
    }

    return dom.window.document

}

async function probeRequest() {

    //reset the state
    resetState()

    const probeRequest = {
        method: 'get', url: `${BASE_URL}/probe`
    }
    const probeResponse = await getXMLResponse(probeRequest)

    //get all the categories , to build a object of elements based on categories
    const allCategoryElements = probeResponse.querySelectorAll('[category]')
    const elements = new Set()
    for (let element of allCategoryElements) {
        elements.add(element.getAttribute("category"))
    }

    //start collecting all the elements based on their categories
    const classifiedElements = {}
    for (let element of elements) {
        const allSelectedElements = probeResponse.querySelectorAll(`[category=${element}]`)

        classifiedElements[`${element}`] = []

        //we are collecting the ids, for using later to update dom
        for (let selectedElement of allSelectedElements) {
            classifiedElements[`${element}`].push(selectedElement.getAttribute('id'))
        }

        globalClassifiedElements = classifiedElements
    }

    //set the nextState to current
    globalNextRequestType = 'current'
}

async function currentRequest() {
    const currentRequest = {
        method: 'get', url: `${BASE_URL}/current`
    }
    const currentResponse = await getXMLResponse(currentRequest)
    globalMachineState = currentResponse

    //extraction of nextSequence no. to keep the loop running 
    //we will update the globalSequenceNo.
    let headerElement = currentResponse.querySelector('Header')
    let nextSequence = headerElement.getAttribute('nextSequence')

    globalNextSequence = nextSequence

    //set the nextState to sample
    globalNextRequestType = 'sample'

}

async function sampleRequest(nextSequence) {
    const sampleRequest = {
        method: 'get', url: `${BASE_URL}/sample?from=${nextSequence}`
    }
    const sampleResponse = await getXMLResponse(sampleRequest)


    //check if the sample response contains some error ? 
    //if it contains OUT_OF_RANGE error -> reset the state of the script
    let errorElements = sampleResponse.querySelectorAll(`[errorCode]`)
    if (errorElements.length != 0) {
        //errors present lets handle
        for (let errorElement of errorElements) {
            let errorCode = errorElement.getAttribute('errorCode')
            switch (errorCode) {
                case 'OUT_OF_RANGE':
                    throw Error(errorElement.textContent)
                    break
                default:
                    throw Error("Fatal Error.")
                    break
            }
        }
    }

    else {
        //helper code below will remove in production
        const changeIds = []
        for (let keys in globalClassifiedElements) {
            for (let element of globalClassifiedElements[`${keys}`]) {
                changeIds.push(element)
            }
        }

        //start with the DOM Manipulation
        //start with the header
        let originalHeader = globalMachineState.querySelector('Header')
        let changeHeader = sampleResponse.querySelector('Header').cloneNode(true)
        originalHeader.parentNode.replaceChild(changeHeader, originalHeader)

        //begin modifying the body
        for (let canChangeId of changeIds) {
            let changeNode = sampleResponse.querySelector(`[dataItemId=${canChangeId}]`) ? sampleResponse.querySelector(`[dataItemId=${canChangeId}]`).cloneNode(true) : null
            if (changeNode !== null) {
                let originalNode = globalMachineState.querySelector(`[dataItemId=${canChangeId}]`)

                //using string comparision for now may change in production
                let serializer = new (globalMachineState.defaultView).XMLSerializer()
                let changeNodeString = serializer.serializeToString(changeNode)
                let orignalNodeString = serializer.serializeToString(originalNode)

                if (changeNodeString !== orignalNodeString) {
                    originalNode.parentNode.replaceChild(changeNode, originalNode)
                }
            }
        }

        //extraction of nextSequence no. to keep the loop running 
        //we will update the globalSequenceNo.
        let headerElement = sampleResponse.querySelector('Header')
        let nextSequence = headerElement.getAttribute('nextSequence')
        globalNextSequence = nextSequence

        //set the nextState to 'sample'
        globalNextRequestType = 'sample'

    }

}


async function main() {

    while (true) {
        switch (globalNextRequestType) {
            case 'probe':
                await probeRequest()
                break
            case 'current':
                await currentRequest()
                break
            case 'sample':
                await sampleRequest(globalNextSequence)
                break
            default:
                break
        }

        await new Promise((resolve, reject) => setTimeout(resolve, POLL_INTERVAL))
    }
}

main()