import _ from 'lodash'


/**
@param {Array<Document>} listOfEvents
*/
export default function filterManager(listOfEvents){

    const to_include = ['eventlogentry' , 'program' , 'controllermode' , 'execution']
    let filteredListOfEvents = listOfEvents.filter((document)=>{
        if(_.includes(to_include , new String(document.tagName).toLowerCase())){
            return document
        }
    })

    return filteredListOfEvents
}