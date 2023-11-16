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
const BASE_URL = "http://mtconnect.mazakcorp.com:5610"
const ENDPOINT_SERIAL_NUMBER = ""


async function getXMLResponse(request){
    const response = await axios(request)
    if(response.status !== 200){
        throw Error(`Invalid HTTP Response /n ${response}`)
    }

    const dom = new JSDOM.JSDOM(response.data , {contentType : 'text/html'})

    if(dom === null || dom === undefined){
        throw Error()
    }

    return dom.window.document

}

async function main(){


    const probeRequest = {
        method : 'get' , url : `${BASE_URL}/probe`
    }

    const probeResponse = await getXMLResponse(probeRequest)

    const allCategoryElements = probeResponse.querySelectorAll('[category]')
    const attributeNames = new Set()
    for(let element of allCategoryElements){
        attributeNames.add(element.getAttribute("category"))
    }

    console.log(attributeNames)

}

main()