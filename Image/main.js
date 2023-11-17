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

async function probeRequest(){
    const probeRequest = {
        method : 'get' , url : `${BASE_URL}/probe`
    }
    const probeResponse = await getXMLResponse(probeRequest)
    
    //get all the categories , to build a object of elements based on categories
    const allCategoryElements = probeResponse.querySelectorAll('[category]')
    const elements = new Set()
    for(let element of allCategoryElements){
        elements.add(element.getAttribute("category"))
    }

    //start collecting all the elements based on their categories
    const classifiedElements = {}
    for(let element of elements){
        const allSelectedElements = probeResponse.querySelectorAll(`[category=${element}]`)

        classifiedElements[`${element}`] = []

        //we are collecting the ids, for using later to update dom
        for(let selectedElement of allSelectedElements){
            classifiedElements[`${element}`].push(selectedElement.getAttribute('id'))    
        }

    }

    console.log(classifiedElements)
}
probeRequest()