import { readFileSync } from 'fs'
import { JSDOM } from 'jsdom'
import axios from 'axios'


function Machine(config){

    let machineConfig = config

    function getSerialNumber(){
        return machineConfig['machine-serial-no']
    }

    function getEndpoint(){
        return machineConfig['machine-base-url']
    }

    return {
        getSerialNumber : getSerialNumber(),
        getEndpoint : getEndpoint()
    }

}




/*
This function breaks the document in to categories
of events , samples , headers , conditions
returns a list of each,
in case if the supplied xml generates an error it just throws the error
*/
function DocumentProcessor(xmlResponse) {

    const originalXmlResponseString = xmlResponse
    let xmlResponseDom = new JSDOM(xmlResponse,{contentType : 'application/xml'}).window
    let xmlDocument = xmlResponseDom.document

    function getHeader() {
        let header = xmlDocument.querySelector('Header')
        let creationTime = header.getAttribute('creationTime')
        let instanceId = header.getAttribute('instanceId')
        let nextSequence = header.getAttribute('nextSequence')

        return {creationTime ,instanceId , nextSequence}
    }

    function getSamples() {
        let samplesList = xmlDocument.querySelectorAll('Samples [dataItemId]')

        let recordedSamplesList = []

        for(let sample of samplesList){
            let dataItemId = sample.getAttribute('dataItemId')
            let name = sample.getAttribute('name')
            let timestamp = sample.getAttribute('timestamp')
            let data = new String(sample.innerHTML)
            
            recordedSamplesList.push({dataItemId , name , timestamp , data})
        }
        
        return recordedSamplesList
    }

    function getEvents() {
        let eventsList = xmlDocument.querySelectorAll('Events [dataItemId]')

        let recordedEventsList = []

        for(let event of eventsList){
            let dataItemId = event.getAttribute('dataItemId')
            let name = event.getAttribute('name')
            let timestamp = event.getAttribute('timestamp')
            let data = new String(event.innerHTML)
            
            recordedEventsList.push({dataItemId , name , timestamp , data})
        }
        
        return recordedEventsList
    }

    function getConditions() {
        let conditionList = xmlDocument.querySelectorAll('Condition [dataItemId]')

        let recordedConditionList = []

        for(let condition of conditionList){
            let dataItemId = condition.getAttribute('dataItemId')
            let name = condition.getAttribute('name')
            let timestamp = condition.getAttribute('timestamp')
            let data = new String(condition.innerHTML)
            let tagName = condition.tagName
            
            recordedConditionList.push({dataItemId , name , timestamp , data , tagName})
        }
        
        return recordedConditionList
    }

    return {
        getHeader: getHeader(),
        getEvents: getEvents,
        getSamples: getSamples,
        getConditions: getConditions
    }

}


async function main() {
    //load the configuration file
    try {
        let configuration = JSON.parse(readFileSync('config.json'))
        let machine = new Machine(configuration)
        

        let sampleResponse = await axios.get(`${machine.getEndpoint}/current`)

        let documentProcessor = new DocumentProcessor(sampleResponse.data)
        console.log(documentProcessor.getHeader)

        console.log(documentProcessor.getConditions())
    }

    catch (error) {

        //catch ENOENT code
        if (error.code === "ENOENT") {
            console.log("File Error")
        }

        else {
            console.log(error)
        }

    }

}


main()